// ==UserScript==
// @name	 kt-maimaidx-site-importer
// @version  1.0.3
// @grant    GM.xmlHttpRequest
// @connect  kamai.tachi.ac
// @author	 cg505, j1nxie, beerpsi
// @include  https://maimaidx-eng.com/maimai-mobile/*
// @include  https://maimaidx.jp/maimai-mobile/*
// @require  https://cdn.jsdelivr.net/npm/@trim21/gm-fetch
// ==/UserScript==

// TODO: Error handling system

console.log("KTIMPORT");

const KT_SELECTED_CONFIG = "prod";
const KT_CONFIGS = {
	"staging": {
		baseUrl: "https://staging.kamaitachi.xyz",
		clientId: "CI5ba595889dca0ebf15f700291084bbf26d199ee4",
	},
	"prod": {
		baseUrl: "https://kamai.tachi.ac",
		clientId: "CIaf985c87034413cd78328c9cad474ed032822125",
	},
};
const KT_BASE_URL = KT_CONFIGS[KT_SELECTED_CONFIG].baseUrl;
const KT_CLIENT_ID = KT_CONFIGS[KT_SELECTED_CONFIG].clientId;
const API_KEY = "api-key";
const LATEST_SCORE_DATE = "latest-score-date";
const DIFFICULTIES = ["BASIC", "ADVANCED", "EXPERT", "MASTER", "Re:MASTER"];

if (typeof GM_fetch !== 'undefined') {
	fetch = GM_fetch;
}

/**
 * @param {string} key
 * @returns {string | null}
 */
function getPreference(key) {
	return localStorage.getItem(`__ktimport__${key}_${KT_SELECTED_CONFIG}`);
}

/**
 * @param {string} key
 * @param {any} value
 * @returns {void}
 */
function setPreference(key, value) {
	return localStorage.setItem(`__ktimport__${key}_${KT_SELECTED_CONFIG}`, value.toString());
}

/**
 * @param {string} url
 * @returns {string}
 */
function getUrlFileNameWithoutExtension(url) {
	return new URL(url).pathname.split("/").pop().split(".").shift();
}

function setupApiKey() {
	window.open(`${KT_BASE_URL}/client-file-flow/${KT_CLIENT_ID}`);
	const inputHtml = `
	<div id="api-key-setup" style="background-color: #fff">
	  <form id="api-key-form">
		<input type="text" id="api-key-form-key" placeholder="Copy API Key here"/>
		<input type="submit" value="Save"/>
	  </form>
	</div>
	`;
	document.querySelector("header").insertAdjacentHTML("afterend", inputHtml);

	document.querySelector("#api-key-setup").addEventListener("submit", submitApiKey);
}

function submitApiKey(event) {
	event.preventDefault();

	const apiKey = document.querySelector("#api-key-form-key").value;
	setPreference(API_KEY, apiKey);

	location.reload();
}

function addNav() {
	const topNode = document.querySelectorAll(".comment_block.break.f_l.f_12")[0];
	const hasApiKey = !!getPreference(API_KEY);

	const apiKeyText = "You don't have an API key set up. Please set up an API key before proceeding.";
	const apiKeyParagraph = document.createElement("p");

	if (!hasApiKey) {
		apiKeyParagraph.append(document.createTextNode(apiKeyText));
		apiKeyParagraph.append(document.createElement("br"));
	}

	let apiKeyLink = hasApiKey ? "Reconfigure API key (if broken)" : "Set up API key";

	const apiKeySetup = document.createElement("a");
	apiKeySetup.id = "setup-api-key-onclick";
	apiKeySetup.append(document.createTextNode(apiKeyLink));
	apiKeySetup.onclick = setupApiKey;

	apiKeyParagraph.append(apiKeySetup);

	const navHtml = document.createElement("div");
	navHtml.append(apiKeyParagraph);
	if (hasApiKey) {
		const navRecent = document.createElement("a");
		const navRecentText = "Import recent scores (preferred)";
		navRecent.onclick = async () => {
			const req = await fetch("/maimai-mobile/record/");
			const docu = (new DOMParser()).parseFromString(await req.text(), "text/html");
			await executeRecentImport(docu);
		}
		navRecent.append(navRecentText);
		navRecent.append(document.createElement("br"));
		navHtml.append(navRecent);

		const navPb = document.createElement("a");
		const navPbText = "Import all PBs";
		navPb.onclick = executePBImport;
		navPb.append(navPbText);
		navPb.append(document.createElement("br"));
		navHtml.append(navPb);

		const navDans = document.createElement("a");
		const navDansText = "Import dan and matching class";
		navDans.onclick = executeDanAndClassImport;
		navDans.append(navDansText);
		navHtml.append(navDans);
	}
	topNode.append(navHtml);
	topNode.id = "kt-import-status";
}

function insertImportButton(message, onClick) {
	if (!getPreference(API_KEY) && window.confirm("You don't have an API key set up. Please set up an API key before proceeding.")) {
		location.href = "/maimai-mobile/home/";
	}

	const importButton = document.createElement("a");
	importButton.id = "kt-import-button";
	importButton.classList = "music_master_btn pointer p_5 t_c f_12 f_b white";
	importButton.borderRadius = "8px";
	importButton.backgroundColor = "#F31A7D";
	importButton.display = "block";
	importButton.margin = "10px auto";
	importButton.padding = "5px";
	importButton.width = "fit-content";
	importButton.append(document.createTextNode(message));

	const prevElem = document.querySelectorAll(".title")[0];
	prevElem.insertAdjacentElement("afterend", importButton);

	document.querySelector("#kt-import-button").onclick = onClick;
}

function updateStatus(message) {
	let statusElem = document.querySelector("#kt-import-status");
	if (!statusElem) {
		statusElem = document.createElement("p");
		statusElem.id = "kt-import-status";
		statusElem.style = "text-align: center; background-color: #fff;";
		const prevElem = document.querySelectorAll(".title")[0];
		prevElem.insertAdjacentElement("afterend", statusElem);
	}

	statusElem.innerText = message;
}

async function pollStatus(url, dan, matchingClass, latestScoreDate = null) {
	const req = await fetch(url, {
		method: "GET",
		headers: {
			"Authorization": `Bearer ${getPreference(API_KEY)}`,
		}
	});

	const body = await req.json();

	if (!body.success) {
		updateStatus("Terminal Error: " + body.description);
		return;
	}

	if (body.body.importStatus === "ongoing") {
		updateStatus("Importing scores... " + body.description + " Progress: " + body.body.progress.description);
		setTimeout(pollStatus, 1000, url, dan, matchingClass);
		return;
	}

	if (body.body.importStatus === "completed") {
		console.log(body.body);
		let message = body.description + ` ${body.body.import.scoreIDs.length} scores`;
		if (dan) {
			message += ` and Dan ${dan}`;
		}
		if (matchingClass) {
			message += ` and Class ${matchingClass}`;
		}
		if (body.body.import.errors.length > 0) {
			message += `, ${body.body.import.errors.length} errors (see console log for details)`;
			for (const error of body.body.import.errors) {
				console.log(`${error.type}: ${error.message}`);
			}
		}
		if (latestScoreDate) {
			setPreference(LATEST_SCORE_DATE, latestScoreDate);
		}
		updateStatus(message);
		return;
	}

	// otherwise, just print the description cuz we're not sure what happened
	updateStatus(body.description);
}

async function submitScores(options) {
	const { scores = [], dan = null, matchingClass = null, saveLatestTimestamp = false } = options;

	let classes = {};
	if (dan) {
		classes.dan = {
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
			11: "SHINDAN_1",
			12: "SHINDAN_2",
			13: "SHINDAN_3",
			14: "SHINDAN_4",
			15: "SHINDAN_5",
			16: "SHINDAN_6",
			17: "SHINDAN_7",
			18: "SHINDAN_8",
			19: "SHINDAN_9",
			20: "SHINDAN_10",
			21: "SHINKAIDEN",
			22: "URAKAIDEN",
		}[dan];
	}

	if (matchingClass) {
		classes.matchingClass = {
			0: "B5",
			1: "B4",
			2: "B3",
			3: "B2",
			4: "B1",
			5: "A5",
			6: "A4",
			7: "A3",
			8: "A2",
			9: "A1",
			10: "S5",
			11: "S4",
			12: "S3",
			13: "S2",
			14: "S1",
			15: "SS5",
			16: "SS4",
			17: "SS3",
			18: "SS2",
			19: "SS1",
			20: "SSS5",
			21: "SSS4",
			22: "SSS3",
			23: "SSS2",
			24: "SSS1",
			25: "LEGEND",
		}[matchingClass];
	}

	if (scores.length === 0 && Object.entries(classes).length === 0) {
		updateStatus("Nothing to import.");
		return;
	}

	const body = {
		meta: {
			game: "maimaidx",
			playtype: "Single",
			service: "site-importer",
		},
		scores,
		classes,
	};

	console.log(JSON.stringify(body));

	const req = fetch(`${KT_BASE_URL}/ir/direct-manual/import`, {
		method: "POST",
		headers: {
			"Authorization": "Bearer " + getPreference(API_KEY),
			"Content-Type": "application/json",
			"X-User-Intent": "true",
		},
		body: JSON.stringify(body),
	});

	document.querySelector("#kt-import-button")?.remove();
	updateStatus("Submitting scores...");

	const json = await (await req).json();
	// if json.success
	const pollUrl = json.body.url;

	const latestScoreDate = scores.length > 0 && saveLatestTimestamp
		? Math.max(...scores.map(s => s.timeAchieved.valueOf()))
		: null;

	updateStatus("Importing scores...");
	pollStatus(pollUrl, dan, classes.matchingClass, latestScoreDate);
}

function calculateLamp([clearStatus, lampStatus], score) {
	const lampMap = {
		"clear": "CLEAR",
		"fc": "FULL COMBO",
		"fcplus": "FULL COMBO+",
		"fcp": "FULL COMBO+",
		"ap": "ALL PERFECT",
		"applus": "ALL PERFECT+",
		"app": "ALL PERFECT+",
	};
	let lamp = null;
	if (lampStatus === "fc_dummy") {
		lamp = lampMap[clearStatus];
	} else {
		lamp = lampMap[lampStatus];
	}

	if (lamp === null || lamp === undefined) {
		lamp = score >= 80 ? "CLEAR" : "FAILED";
	}

	return lamp;
}

function getChartType(row) {
	if (row.id) {
		// for multi-ChartType songs in song list
		return row.id.includes("sta_") ? "standard" : "dx";
	}
	const chartTypeImg = row.querySelector(".music_kind_icon, .playlog_music_kind_icon");
	if (!(chartTypeImg instanceof HTMLImageElement)) {
		return "dx";
	}

	return getUrlFileNameWithoutExtension(chartTypeImg.src).replace("music_", "");
}

function getDifficulty(row, selector, style) {
	let difficulty = getUrlFileNameWithoutExtension(row.querySelector(selector).src).replace("diff_", "");

	difficulty = difficulty.replace(difficulty[0], difficulty[0].toUpperCase());

	if (difficulty === "Remaster") {
		difficulty = "Re:Master";
	}

	if (style === "dx") {
		difficulty = "DX " + difficulty;
	}
	return difficulty;
}

function isNicoNicoLinkImg(jacket) {
	return jacket.includes("e90f79d9dcff84df");
}

async function isNiconicoLink(detailIdx = null) {
	const html = await fetch(`/maimai-mobile/record/musicDetail/?idx=${encodeURIComponent(detailIdx)}`).then(r => r.text());
	const doc = new DOMParser().parseFromString(html, "text/html");
	const jacket = doc.querySelector(".basic_block img")?.src;
	return jacket ? isNicoNicoLinkImg(jacket) : doc.querySelector(".m_10.m_t_5.t_r.f_12").innerText.includes("niconico");
}

function isIrodorimidoriImg(jacket) {
	return jacket.includes("29d12992cfd1d731");
}

async function isIrodorimidoriLink(detailIdx = null) {
	const html = await fetch(`/maimai-mobile/record/musicDetail/?idx=${encodeURIComponent(detailIdx)}`).then(r => r.text());
	const doc = new DOMParser().parseFromString(html, "text/html");
	const jacket = doc.querySelector(".basic_block img")?.src;
	return jacket ? isIrodorimidoriImg(jacket) : doc.querySelector(".m_10.m_t_5.t_r.f_12").innerText.includes("オンゲキ&CHUNITHM");
}

/**
 * @param {string} timestamp
 * @returns {Date}
 */
function parseTimestamp(timestamp) {
	const match = timestamp.match("([0-9]{4})/([0-9]{1,2})/([0-9]{1,2}) ([0-9]{1,2}):([0-9]{2})");
	let [_, year, month, day, hour, minute] = match;

	month = month.padStart(2, "0");
	day = day.padStart(2, "0");
	hour = hour.padStart(2, "0");

	// Construct iso-8601 time
	const isoTime = `${year}-${month}-${day}T${hour}:${minute}:00.000+09:00`;
	return new Date(isoTime);
}

async function executeRecentImport(docu = document) {
	const latestScoreDate = Number(getPreference(LATEST_SCORE_DATE) ?? 0);
	const scoresElems = [...docu.querySelectorAll(".p_10.t_l.f_0.v_b")]
		.filter(e => parseTimestamp(e.querySelector(".sub_title .v_b:not(.red)").innerHTML).valueOf() > latestScoreDate);

	let sinceDateString = "...";
	if (latestScoreDate > 0) {
		sinceDateString = ` since ${new Date(latestScoreDate).toLocaleString()}...`;
	}

	let scoresList = [];

	for (let i = 0; i < scoresElems.length; i++) {
		updateStatus(`Fetching recent score ${i + 1}/${scoresElems.length}${sinceDateString}`);
		const e = scoresElems[i];
		let scoreData = {
			percent: 0,
			lamp: "",
			matchType: "songTitle",
			identifier: "",
			difficulty: "",
			timeAchieved: 0,
			judgements: {
				pcrit: 0,
				perfect: 0,
				great: 0,
				good: 0,
				miss: 0,
			},
			hitMeta: {
				fast: 0,
				slow: 0,
				maxCombo: 0,
			}
		};

		scoreData.identifier = e.querySelector(".basic_block.m_5.p_5.p_l_10.f_13.break").innerText;

		if (scoreData.identifier === "　") {
			scoreData.identifier = "";
		}
		if (scoreData.identifier === "Link") {
			const jacket = e.querySelector(".p_r.f_0 img").src;
			scoreData.matchType = "tachiSongID";
			// IDs from https://github.com/TNG-dev/Tachi/blob/staging/database-seeds/collections/songs-maimaidx.json
			scoreData.identifier = isNicoNicoLinkImg(jacket) ? "244" : "68";
		}
		if (scoreData.identifier === "TRUST" || scoreData.identifier === "Trust") {
				
			const detailIdx = e.querySelector("form input[name=idx]").value;
			scoreData.matchType = "tachiSongID";
			// IDs from https://github.com/TNG-dev/Tachi/blob/staging/database-seeds/collections/songs-maimaidx.json
			scoreData.identifier = await isIrodorimidoriLink(detailIdx) ? "461" : "1385";
		}

		const style = getChartType(e);
		const difficulty = getDifficulty(e, ".playlog_diff.v_b", style);

		if (difficulty === "Utage" || difficulty === "DX Utage") {
			console.log(`Ignoring score ${scoreData.identifier} [${difficulty}].`);
			continue;
		}

		scoreData.difficulty = difficulty;

		const scoreElem = e.querySelector(".playlog_achievement_txt.t_r").innerHTML
			.replace('<span class="f_20">', '').replace("</span>", "");
		scoreData.percent = parseFloat(scoreElem.match(/[0-9]+.[0-9]+/)[0]);

		if (scoreData.percent > 101) {
			console.warn(`Ignoring score ${scoreData.identifier} [${difficulty}] because ${scoreData.percent} > 101%.`);
			continue;
		}

		const clearStatusElement = e.querySelector(".w_80.f_r");
		let clearStatus = null;
		if (clearStatusElement !== null) {
			clearStatus = getUrlFileNameWithoutExtension(clearStatusElement.src);
		}
		const lampStatus = getUrlFileNameWithoutExtension(
			e.querySelector(".playlog_result_innerblock.basic_block.p_5.f_13").children[1].src
		);
		scoreData.lamp = calculateLamp([clearStatus, lampStatus], scoreData.percent);

		const timestampElem = e.querySelector(".sub_title.t_c.f_r.f_11").getElementsByClassName("v_b")[1];
		scoreData.timeAchieved = parseTimestamp(timestampElem.innerHTML).valueOf();

		const idx = e.querySelector(".m_t_5.t_r")
			.getElementsByTagName("input")[0].value;

		let req = await fetch(`/maimai-mobile/record/playlogDetail/?idx=${idx}`);
		let doc = (new DOMParser()).parseFromString(await req.text(), "text/html");

		[...doc.querySelector(".playlog_notes_detail.t_r.f_l.f_11.f_b").querySelectorAll("tr")].slice(1).map((row) => {
			scoreData.judgements.pcrit = scoreData.judgements.pcrit + Number(row.querySelectorAll("td")[0].innerHTML)
			scoreData.judgements.perfect = scoreData.judgements.perfect + Number(row.querySelectorAll("td")[1].innerHTML)
			scoreData.judgements.great = scoreData.judgements.great + Number(row.querySelectorAll("td")[2].innerHTML)
			scoreData.judgements.good = scoreData.judgements.good + Number(row.querySelectorAll("td")[3].innerHTML)
			scoreData.judgements.miss = scoreData.judgements.miss + Number(row.querySelectorAll("td")[4].innerHTML)
		});

		scoreData.hitMeta.fast = Number(doc.querySelectorAll(".w_96.f_l.t_r")[0].textContent);
		scoreData.hitMeta.slow = Number(doc.querySelectorAll(".w_96.f_l.t_r")[1].textContent);

		scoreData.hitMeta.maxCombo = Number(doc.querySelector(".f_r.f_14.white").innerHTML.match(/([0-9]+)\/([0-9]+)/)[1]);

		scoresList.push(scoreData);
	}
	submitScores({ scores: scoresList, saveLatestTimestamp: true });
}

function warnPbImport() {
	document.querySelector("#kt-import-button").remove();

	insertImportButton("Confirm DANGEROUS operation", async () => await executePBImport());
	const pbWarning = `
	<p id="kt-import-pb-warning" class="p_10" style="text-align: center; background-color: #fff">
	  <span style="color: #f00">WARNING!</span>
	  PB import is not recommended in general! PBs do not have timestamp data, and will not create
	  sessions. Only import PBs <em>after</em> importing recent scores.
	</p>
	`;
	document.querySelector("#kt-import-button").insertAdjacentHTML("afterend", pbWarning);

}

async function executePBImport() {
	const scoresList = [];

	for (let i = 0; i < 5; i++) {
		updateStatus(`Fetching scores for ${DIFFICULTIES[i]}...`);
		const req = await fetch(`/maimai-mobile/record/musicGenre/search/?genre=99&diff=${i}`);
		const doc = (new DOMParser()).parseFromString(await req.text(), "text/html");

		const elems = doc.querySelectorAll(".w_450.m_15.p_r.f_0");

		for (const e of elems) {
			let scoreData = {
				percent: 0,
				lamp: "",
				matchType: "songTitle",
				identifier: "",
				difficulty: getDifficulty(e, ".h_20.f_l", getChartType(e)),
			};

			scoreData.identifier = e.querySelector(".music_name_block.t_l.f_13.break").innerText;
			if (scoreData.identifier === "　") {
				scoreData.identifier = "";
			}
			if (scoreData.identifier === "Link") {
				const detailIdx = e.querySelector("form input[name=idx]").value;
				scoreData.matchType = "tachiSongID";
				// IDs from https://github.com/TNG-dev/Tachi/blob/staging/database-seeds/collections/songs-maimaidx.json
				scoreData.identifier = await isNiconicoLink(detailIdx) ? "244" : "68";
			}
			if (scoreData.identifier === "TRUST" || scoreData.identifier === "Trust") {
				
				const detailIdx = e.querySelector("form input[name=idx]").value;
				scoreData.matchType = "tachiSongID";
				// IDs from https://github.com/TNG-dev/Tachi/blob/staging/database-seeds/collections/songs-maimaidx.json
				scoreData.identifier = await isIrodorimidoriLink(detailIdx) ? "461" : "1385";
			}

			const scoreElem = e.querySelector(".music_score_block.w_112.t_r.f_l.f_12");
			if (scoreElem === null) {
				continue;
			}
			scoreData.percent = parseFloat(scoreElem.innerText.match(/[0-9]+.[0-9]+/)[0]);

			const lampElem = getUrlFileNameWithoutExtension(
				e.querySelectorAll(".h_30.f_r")[1].src
			)
				.replace("music_icon_", "");
			scoreData.lamp = calculateLamp(["", lampElem], scoreData.percent);

			scoresList.push(scoreData);
		}
	}

	document.querySelector("#kt-import-pb-warning")?.remove();
	submitScores({ scores: scoresList });
}

async function executeDanAndClassImport() {
	const danBadge = document.querySelector(".h_35.f_l").src;
	let danNumber = Number(getUrlFileNameWithoutExtension(danBadge).replace("course_rank_", "").substring(0, 2));

	if (danNumber > 11) {
		danNumber = danNumber - 1;
	}

	const classBadge = document.querySelector(".p_l_10.h_35.f_l").src;
	const classNumber = Number(getUrlFileNameWithoutExtension(classBadge).replace("class_rank_s_", "").substring(0, 2));

	await submitScores({ dan: danNumber, matchingClass: classNumber });
}

console.log("running");

switch (location.pathname) {
	case "/maimai-mobile/record/musicGenre/":
	case "/maimai-mobile/record/musicWord/":
	case "/maimai-mobile/record/musicLevel/":
	case "/maimai-mobile/record/musicVersion/":
	case "/maimai-mobile/record/musicSort/":
		insertImportButton("IMPORT ALL PBs", warnPbImport);
		break;

	case "/maimai-mobile/record/":
		insertImportButton("IMPORT RECENT SCORES", async () => await executeRecentImport(document));
		break;

	case "/maimai-mobile/home/":
		addNav();
		break;

	case "/maimai-mobile/playerData/":
		insertImportButton("IMPORT DANS AND CLASSES", async () => await executeDanAndClassImport(document));
		break;
}
