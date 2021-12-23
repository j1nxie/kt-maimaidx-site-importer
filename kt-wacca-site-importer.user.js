// ==UserScript==
// @name     kt-wacca-site-importer
// @version  0.0.2
// @grant    none
// @author   cg505
// @include  https://wacca.marv-games.jp/web/*
// ==/UserScript==

// TODO: Error handling system

console.log("KTIMPORT")

const KT_SELECTED_CONFIG = "staging"
const KT_CONFIGS = {
  "staging": {
    baseUrl: "https://staging.kamaitachi.xyz",
    clientId: "CI6421e070584bf2807812064a36d4dc68803dfbb7",
  },
  "prod": {
    baseUrl: "https://kamaitachi.xyz",
    clientId: "CI3bf0110f23dbe90d5b84c2d3fecf752af2b0b1f6",
  },
}
const KT_BASE_URL = KT_CONFIGS[KT_SELECTED_CONFIG].baseUrl
const KT_CLIENT_ID = KT_CONFIGS[KT_SELECTED_CONFIG].clientId
const LS_API_KEY_KEY = "__ktimport__api-key"

function getApiKey() {
  return localStorage.getItem(`${LS_API_KEY_KEY}_${KT_SELECTED_CONFIG}`)
}

function setApiKey(value) {
  return localStorage.setItem(`${LS_API_KEY_KEY}_${KT_SELECTED_CONFIG}`, value)
}

function setupApiKey() {
  window.open(`${KT_BASE_URL}/client-file-flow/${KT_CLIENT_ID}`)
  const inputHtml = `
		<div id="api-key-setup" style="background-color: #fff">
		  <form id="api-key-form">
				<input type="text" id="api-key-form-key" placeholder="Copy API Key here"/>
				<input type="submit" value="Save"/>
			</form>
		</div>
	`
  document.querySelector("header").insertAdjacentHTML("afterend", inputHtml)

  document.querySelector("#api-key-setup").addEventListener("submit", submitApiKey)
}

function submitApiKey(event) {
  event.preventDefault()

  const apiKey = document.querySelector("#api-key-form-key").value
  console.log(apiKey)
  setApiKey(apiKey)

  location.reload()
}

function addNav() {
  const topNode = document.querySelector("header")
  const hasApiKey = !!getApiKey()
  let apiKeyText = `
		<p style="color: #fff; text-align: center;">
			You don't have an API Key set up. Please \"Set up an API Key\" before proceeding.
		</p>
	`
  if (hasApiKey) {
    apiKeyText = ""
  }
	let apiKeyLink = "<a id=\"setup-api-key-onclick\">Set up API Key (DO THIS FIRST)</a>"
  if (hasApiKey) {
    apiKeyLink = "<a id=\"setup-api-key-onclick\">Reconfigure API Key (if broken)</a>"
  }
  const navHtml = `
    <div style="background-color: #000">
			${apiKeyText}
      <a href="/web/history">Jump to recent score import (preferred)</a><br />
      <a href="/web/music">Jump to PB import</a><br />
			${apiKeyLink}
    </div>
  `
  topNode.insertAdjacentHTML("afterend", navHtml)

  document.querySelector("#setup-api-key-onclick").onclick = setupApiKey
}

function insertImportButton(message, onClick) {
  const importButton = `
		<a id="kt-import-button" style="box-shadow: 0 0 0 2px #FFF, 0 0 0 4px #9E9E9E; border-radius: 8px; background-color: #F31A7D; display: block; margin: 10px auto; padding: 5px; width: fit-content;">
			${message}
		</a>
	`
  document.querySelector(".playdata__tab").insertAdjacentHTML("afterend", importButton)

  document.querySelector("#kt-import-button").onclick = onClick
}

function updateStatus(message) {
  let statusElem = document.querySelector("#kt-import-status")
  if (!statusElem) {
    statusElem = document.createElement("p")
    statusElem.id = "kt-import-status"
    statusElem.style = "text-align: center; background-color: #fff;"
    document.querySelector(".playdata__tab").insertAdjacentElement("afterend", statusElem)
  }

  statusElem.innerText = message
}

async function pollStatus(url) {
  const resp = await fetch(url, {
    headers: {
      "Authorization": "Bearer " + getApiKey(),
    },
  })

  const body = await resp.json()

  if (!body.success) {
    updateStatus("Terminal Error: " + body.description)
    return
  }

  if (body.body.importStatus === "ongoing") {
    updateStatus("Importing scores... " + body.description + " Progress: " + body.body.progress.description)
    setTimeout(pollStatus, 1000, url)
    return
  }

  if (body.body.importStatus === "completed") {
    console.log(body.body)
    let message = body.description + ` ${body.body.import.scoreIDs.length} scores`
    if (body.body.import.errors.length > 0) {
    	message += `, ${body.body.import.errors.length} errors (see console log for details)`
      for (const error of body.body.import.errors) {
      	console.log(`${error.type}: ${error.message}`)
      }
    }
    updateStatus(message)
    return
  }

  // otherwise, just print the description cuz we're not sure what happened
  updateStatus(body.description)
}

async function submitScores(scores) {
  const body = {
    meta: {
      game: "wacca",
      playtype: "Single",
      service: "wacca-site-importer",
    },
    scores,
  }

  console.log(JSON.stringify(body))

  const fetchRequest = fetch(`${KT_BASE_URL}/ir/direct-manual/import`, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + getApiKey(),
      "Content-Type": "application/json",
      "X-User-Intent": "true",
    },
    body: JSON.stringify(body),
  })

  document.querySelector("#kt-import-button").remove()
  updateStatus("Submitting scores...")

  const resp = await fetchRequest
  const json = await resp.json()
  // if json.success
  const pollUrl = json.body.url

  updateStatus("Importing scores...")
  pollStatus(pollUrl)
}

function calculateLamp(lampElem, score) {
  const lampMap = {
    "no_achieve.svg": "FAILED",
    "achieve1.png": "CLEAR",
    "achieve2.png": "MISSLESS",
    "achieve3.png": "FULL COMBO",
  }
  const srcParts = lampElem.src.split("/")
  let lamp = lampMap[srcParts[srcParts.length - 1]]
  if (score === 1_000_000) {
    lamp = "ALL MARVELOUS"
  }
  return lamp
}

function extractDetailsInfo(liElem, expectedIcon) {
	const iconSrcParts = liElem.querySelector("div.detail-table__icon > img").src.split("/")
  // Sanity check
  if (iconSrcParts[iconSrcParts.length - 1] !== expectedIcon) {
    throw efg;
  }

  return liElem.querySelector("div.detail-table__score")
}

function executeRecentImport() {
  const scoresElems = document.querySelectorAll(".playdata__history-list__wrap > li")
  let scoresList = []

  scoresElems.forEach(e => {
    const title = e.querySelector(".playdata__history-list__song-info__name").innerText

    const level = e.querySelector(".playdata__history-list__song-info__lv")
    const difficulty = level.innerText.match(/NORMAL|HARD|EXPERT|INFERNO/)[0]

    const scoreElem = e.querySelector(".playdata__history-list__song-info__score")
    const score = parseInt(scoreElem.innerText.match(/[0-9]+/)[0])

    const lampElem = e.querySelector(".playdata__history-list__icon").children[1].children[0]
    // Sanity check
    if (lampElem.tagName !== "IMG" || lampElem.alt !== "achieveimage") {
      throw abc;
    }
    const lamp = calculateLamp(lampElem, score)

    const timestampElem = e.querySelector(".playdata__history-list__song-info__top")
    // Break out pieces, put into utc string with timezone info
    const match = timestampElem.innerText.match("([0-9]{4})/([0-9]{1,2})/([0-9]{1,2}) ([0-9]{1,2}):([0-9]{2}):([0-9]{2})")
    let [_, year, month, day, hour, minute, second] = match
    if (month.length === 1) {
      month = "0" + month
    }
    if (day.length === 1) {
      day = "0" + day
    }

		if (hour.length === 1) {
      hour = "0" + hour
    }
    // Construct iso-8601 time
    const isoTime = `${year}-${month}-${day}T${hour}:${minute}:${second}.000+09:00`
    // Parse with Date, then get unix time
    const date = new Date(isoTime)
    const timeAchieved = date.valueOf()

    const details = e.querySelector(".playdata__detail-table").children

    const marvelous = parseInt(extractDetailsInfo(details[0], "decision_marvelous.png").innerText)
    const great = parseInt(extractDetailsInfo(details[1], "decision_great.png").innerText)
    const good = parseInt(extractDetailsInfo(details[2], "decision_good.png").innerText)
    const miss = parseInt(extractDetailsInfo(details[3], "decision_miss.png").innerText)

    const fast = parseInt(extractDetailsInfo(details[4], "fastslow_fast.png").innerText)
    const slow = parseInt(extractDetailsInfo(details[5], "fastslow_late.png").innerText)

    const comboDiv = extractDetailsInfo(details[6], "combo.png")
    const maxCombo = parseInt(comboDiv.querySelector("span.combo__num").innerText)

    scoresList.push({
      score,
      lamp,
      matchType: "songTitle",
      identifier: title,
      difficulty,
      timeAchieved,
      judgements: {
        marvelous,
        great,
        good,
        miss,
      },
      hitMeta: {
        fast,
        slow,
        maxCombo,
      },
    })
  })

  submitScores(scoresList)
}

function warnPbImport() {
  document.querySelector("#kt-import-button").remove()

  insertImportButton("Confirm DANGEROUS operation", executePBImport)
  const pbWarning = `
		<p id="kt-import-pb-warning" style="text-align: center; background-color: #fff">
			<span style="color: #f00">WARNING!</span>
			PB import is not recommended in general! PBs do not have timestamp data, and will not create
			sessions. Only import PBs <em>after</em> importing recent scores.
		</p>
  `
  document.querySelector(".playdata__tab").insertAdjacentHTML("afterend", pbWarning)

}

function executePBImport() {
  // https://github.com/shimmand/waccaSupportTools/blob/main/analyzePlayData/main.js

  // #pushobj > section > div.contents-wrap > div.playdata__score-list > ul > li:nth-child(any)
  const songs = document.querySelectorAll("li.item")
  let scoresList = []

  songs.forEach(e => {
    const title = e.querySelector(".playdata__score-list__song-info__name").innerText
    const levels = e.querySelectorAll(".playdata__score-list__song-info__lv")
    const scores = e.querySelectorAll(".playdata__score-list__song-info__score")
    const lamps = e.querySelectorAll(".playdata__score-list__icon")

    // Iterate through the 4 difficulties (all 4 should always be present).
    for (let i = 0; i < 4; i++) {
      if (i >= levels.length) {
        console.warn(`Unexpected import error: only ${levels.length} levels detected for ${title}`)
      }
      if (i >= scores.length) {
        console.warn(`Unexpected import error: only ${scores.length} scores detected for ${title}`)
      }
      if (i >= lamps.length) {
        console.warn(`Unexpected import error: only ${lamps.length} lamps detected for ${title}`)
      }

      // This includes the grade img and the lamp img
      const lampNodes = Array.from(lamps[i].querySelectorAll("img"))
      if (lampNodes.find(n => n.alt === "noRate")) {
        // This indicates that the chart has not been played
        continue
      }

      const score = parseInt(scores[i].innerText.match(/[0-9]+/)[0])

      const lampImg = lampNodes.find(n => n.alt === "achieveimage")
			const lamp = calculateLamp(lampImg, score)
      
      const difficulty = levels[i].innerText.match(/NORMAL|HARD|EXPERT|INFERNO/)[0]

      scoresList.push({
        score,
        lamp,
        matchType: "songTitle",
        identifier: title,
        difficulty
      })
    }
  })

  document.querySelector("#kt-import-pb-warning").remove()
  submitScores(scoresList)
}

console.log("running")

addNav()

switch (location.pathname) {
  case "/web/music":
    insertImportButton("IMPORT ALL PBs", warnPbImport)
    break

  case "/web/history":
    insertImportButton("IMPORT RECENT SCORES", executeRecentImport)
    break
}
