// ==UserScript==
// @name	 kt-maimaidx-site-importer
// @version  1.0.0
// @grant	 GM.xmlHttpRequest
// @connect  kamaitachi.xyz
// @author	 j1nxie 
// @include  https://maimaidx-eng.com/maimai-mobile/*
// ==/UserScript==

// TODO: Error handling system

console.log("KTIMPORT")

const KT_SELECTED_CONFIG = "staging"
const KT_CONFIGS = {
	"staging": {
		baseUrl: "https://staging.kamaitachi.xyz",
		clientId: "CI5ba595889dca0ebf15f700291084bbf26d199ee4",
	},
	"prod": {
		baseUrl: "https://kamaitachi.xyz",
		clientId: "CIaf985c87034413cd78328c9cad474ed032822125",
	},
}
const KT_BASE_URL = KT_CONFIGS[KT_SELECTED_CONFIG].baseUrl
const KT_CLIENT_ID = KT_CONFIGS[KT_SELECTED_CONFIG].clientId
const LS_API_KEY_KEY = "__ktimport__api-key"

function requestPromise(details) {
	return new Promise((resolve, reject) => GM.xmlHttpRequest({
		responseType: "json",
		onload: resolve,
		onabort: reject,
		onerror: reject,
		...details
	}))
}

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
	setApiKey(apiKey)

	location.reload()
}

function addNav() {
	const topNode = document.querySelector(".comment_block.break.f_1.f_12")
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
	  <a href="/maimai-mobile/record">Jump to recent score import (preferred)</a><br />
	  <a href="/maimai-mobile/record/musicGenre">Jump to PB import</a><br />
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
	const prevElem = document.querySelector(".playdata__tab") || document.querySelector(".common-nav")
	prevElem.insertAdjacentHTML("afterend", importButton)

	document.querySelector("#kt-import-button").onclick = onClick
}

function updateStatus(message) {
	let statusElem = document.querySelector("#kt-import-status")
	if (!statusElem) {
		statusElem = document.createElement("p")
		statusElem.id = "kt-import-status"
		statusElem.style = "text-align: center; background-color: #fff;"
		const prevElem = document.querySelector(".playdata__tab") || document.querySelector(".common-nav")
		prevElem.insertAdjacentElement("afterend", statusElem)
	}

	statusElem.innerText = message
}

async function pollStatus(url, stageUp) {
	const req = await requestPromise({
		method: "GET",
		url,
		headers: {
			"Authorization": "Bearer " + getApiKey(),
		},
	})

	const body = req.response

	if (!body.success) {
		updateStatus("Terminal Error: " + body.description)
		return
	}

	if (body.body.importStatus === "ongoing") {
		updateStatus("Importing scores... " + body.description + " Progress: " + body.body.progress.description)
		setTimeout(pollStatus, 1000, url, stageUp)
		return
	}

	if (body.body.importStatus === "completed") {
		console.log(body.body)
		let message = body.description + ` ${body.body.import.scoreIDs.length} scores`
		if (stageUp) {
			message += ` and Stage ${stageUp}`
		}
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
	let classes = {}
	if (dans) {
		classes.dans = {
			1: "DAN_1",
			2: "DAN_2",
			3: "DAN_3",
			4: "DAN_4",
			5: "DAN_5",
			6: "DAN_6",
			7: "DAN_7",
			8: "DAN_8",
			9: "DAN_9",
			10: "DAN_10",
			11: "SHINSHODAN",
			12: "SHINDAN_2",
			13: "SHINDAN_3",
			14: "SHINDAN_4",
			15: "SHINDAN_5",
			16: "SHINDAN_6",
			18: "SHINDAN_7",
			19: "SHINDAN_8",
			20: "SHINDAN_9",
			21: "SHINDAN_10",
			22: "SHINKAIDEN",
		}[dans]
	}
	const body = {
		meta: {
			game: "maimaidx",
			playtype: "Single",
			service: "site-importer",
		},
		scores,
		classes,
	}

	console.log(JSON.stringify(body))

	const req = requestPromise({
		method: "POST",
		url: `${KT_BASE_URL}/ir/direct-manual/import`,
		headers: {
			"Authorization": "Bearer " + getApiKey(),
			"Content-Type": "application/json",
			"X-User-Intent": "true",
		},
		data: JSON.stringify(body)
	})

	document.querySelector("#kt-import-button").remove()
	updateStatus("Submitting scores...")

	const json = (await req).response
	// if json.success
	const pollUrl = json.body.url

	updateStatus("Importing scores...")
	pollStatus(pollUrl, dans)
}

function calculateLamp(totalLamp, score) {
	const lampMap = {
		"clear.png": "CLEAR",
		"fc.png": "FULL COMBO",
		"fcplus.png": "FULL COMBO+",
		"ap.png": "ALL PERFECT",
		"applus.png": "ALL PERFECT+",
	}
	if totalLamp[1] === "fc_dummy" {
		let lamp = lampMap[totalLamp[0]]
	} else {
		let lamp = lampMap[totalLamp[1]]
	}

	if lamp === null {
		lamp = "FAILED"
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
	const scoresElems = document.getElementsByClassName("p_10 t_l f_0 v_b");
	let scoresList = []

	scoresElems.forEach(e => {
		const title = e.querySelector(".basic_block.m_5.p_5.p_1_10.f_13.break").innerText

		const style = e.querySelector(".playlog_music_kind_icon")[0].src
			.replace("https://maimaidx-eng.com/maimai-mobile/img/music_", "").replace(".png", "")
		let difficultyName = e.querySelector(".playlog_top_container img")[0].src
			.replace("https://maimaidx-eng.com/maimai-mobile/img/diff_", "").replace(".png", "")
			.replace(difficultyName[0], difficultyName[0].toUpperCase())

		if style === "dx" {
			difficultyName == "DX" + difficultyName
		}

		const scoreElem = e.querySelector(".playlog_achievement_txt.t_r")[0].innerHTML
			.replace('<span class = "f_20"', '').replace("<span>", "")
		const score = parseFloat(scoreElem.innerText.match(/[0-9]+.[0-9]+/)[0])

		const clearStatus = e.querySelector(".basic_block.m_5.p_5.p_l.f_13.break")[0].src
			.replace("https://maimaidx-eng.com/maimai-mobile/img/playlog/", "").replace(".png", "")
		const lampStatus = e.querySelector(".playlog_result_innerblock.basic_block.p_5.f_13")[0].src
			.replace("https://maimaidx-eng.com/maimai-mobile/img/playlog/", "").replace(".png?ver=1.25", "")
		const totalLamp = [clearStatus, lampStatus]
		const lamp = calculateLamp(totalLamp, score)

		const timestampElem = e.querySelector(".sub_title.t_c.f_r.f_11")[0].getElementByClassName("v_b")[1]
		// Break out pieces, put into utc string with timezone info
		const match = timestampElem.innerHTML.match("([0-9]{4})/([0-9]{1,2})/([0-9]{1,2}) ([0-9]{1,2}):([0-9]{2})")
		let [_, year, month, day, hour, minute] = match
		if (month.length === 1) {
			month = "0" + month
		}
		if (day.length === 1) {
			day = "0" + day
		}

		if (hour.length === 1) {
			hour = "0" + hour
		}
		const second = "00"
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
				pcrit,
				perfect,
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

/*
function executeDanImport() {
	const stageUpBadge = document.querySelectorAll("")
	const path = stageUpBadge[0].children[0].src
	const stage = path.match("https://wacca.marv-games.jp/img/web/stage/rank/stage_icon_([0-9]{1,2})_[1-3].png")[1]
	submitScores([], stage)
}
*/

console.log("running")

addNav()

switch (location.pathname) {
	case "/maimai-mobile/record/musicGenre":
		insertImportButton("IMPORT ALL PBs", warnPbImport)
		break

	case "/maimai-mobile/record":
		insertImportButton("IMPORT RECENT SCORES", executeRecentImport)
		break

	case "/maimai-mobile/home":
	case "/maimai-mobile/playerData":
		insertImportButton("IMPORT STAGEUP", executeStageUpImport)
		break
}
