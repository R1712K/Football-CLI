#!/usr/bin/env node

import randomUseragent from "random-useragent";
import { spawn } from "child_process";
import { program } from "commander";
import puppeteer from "puppeteer";
import inquirer from "inquirer";
import { join } from "path";
import fs from "fs-extra";
import chk from "chalk";
import ora from "ora";

const BASE_URL = "https://www.rojadirectaenvivo.pl/";
const userAgent = randomUseragent.getRandom(); // Get a random UA
const CACHE_FILE = join("./", "cache.json");

process.on('uncaughtException', (error) => {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      console.log(chk.cyan('👋 until next time!'));
    } else {
      // Rethrow unknown errors
      throw error;
    }
});

// Load cache to avoid unnecessary re-scraping
async function loadCache() {
    try {
        return await fs.readJson(CACHE_FILE);
    } catch (err) {
        return {};
    }
}

async function saveCache(cache) {
    await fs.writeJson(CACHE_FILE, cache, { spaces: 2 });
}

async function setupBrowser() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Set custom HTTP headers
    await page.setExtraHTTPHeaders({
        "User-Agent": userAgent,
        "Accept-Language": "en-US,en;q=0.5",
        "Referer": "https://www.google.com/",
        "DNT": "1",  // Do Not Track (makes requests look more legit)
    });

    return { browser, page };
}

async function fetchAllMatchData(URL) {
    const { browser, page } = await setupBrowser();
    await page.goto(URL, { waitUntil: "networkidle2" });

    const matches = await page.evaluate(() => {
        return Array.from(document.querySelectorAll(".menu > li")).map(match => ({
            type: match.className,
            teams: match.querySelector("a").innerText.replace(/\n/, ' - '),
            time: match.querySelector("a > .t").innerText,
            links: Array.from(match.querySelectorAll("li a")).map(link => ({
                name: link.innerText,
                link: link.getAttribute("href"),
            })),
        }));
    });

    await browser.close();
    return matches;
}

async function fetchMatchData(URL, matchName) {
    const { browser, page } = await setupBrowser();
    await page.goto(URL, { waitUntil: "networkidle2" });

    const match = await page.evaluate((matchName) => {
        const matchElement = Array.from(document.querySelectorAll(".menu > li")).find(match => {
            return match.querySelector("a").innerText.replace(/^.*?:\s*/, '')
                                                     .replace(/\n\d{1,2}:\d{2}\s?[ap]m$/, '')
                                                     .trim() === matchName;
        });

        if (!matchElement) return null;

        return {
            type: matchElement.className,
            teams: matchElement.querySelector("a").innerText.replace(/\n/, ' - '),
            time: matchElement.querySelector("a > .t").innerText,
            links: Array.from(matchElement.querySelectorAll("li a")).map(link => ({
                name: link.innerText,
                link: link.getAttribute("href"),
            })),
        }
    }, matchName);

    await browser.close();
    return match;
}

async function getPlaybackURL(href) {
    const { browser, page } = await setupBrowser();
    await page.goto(href, { waitUntil: "networkidle2" });
    console.log("Visited page: ", href);

    // Get outer frame's source
    await page.waitForSelector('iframe');
    const outerFrame = await page.$('iframe');
    const outerFrameSrc = await outerFrame.evaluate(() => {
        return document.querySelector("div > iframe").src;
    });
    if (!outerFrameSrc) {
        console.error("Outer iframe not found!");
        return;
    }
    
    await page.goto(outerFrameSrc, {waitUntil: "networkidle2"});
    console.log("Visited page: ", outerFrameSrc);

    // Get inner frame's source
    await page.waitForSelector("iframe");
    const innerFrame = await page.$('iframe');
    const innerFrameSrc = await innerFrame.evaluate(() => {
        return document.querySelector("body > iframe").src;
    });
    if (!innerFrameSrc) {
        console.error("Inner iframe not found!");
        return;
    }

    await page.goto(innerFrameSrc, { waitUntil: "networkidle2" } );
    console.log("Visited page: ", innerFrameSrc);

    // Extract variable from script tag
    const videoURL = await page.evaluate(() => {
        return window.playbackURL; // Access global variable
    });
    console.log('Extracted Video URL:', videoURL);
    await browser.close();
    return videoURL;
}

async function getVideoSource(selectedMatchLink) {
    const spinner = ora("Fetching video URL...").start();
    try {
        const videoSource = await getPlaybackURL(selectedMatchLink);
        spinner.succeed("Stream URL retrieved.");
        return videoSource;
    } catch (err) {
        spinner.fail("Failed to get video source.");
        return null;
    }
}

async function getAllMatches() {
    const spinner = ora(`Searching for all available matches"...`).start();
    try {
        const results = await fetchAllMatchData(BASE_URL);
        spinner.succeed(`Found ${results.length} results.`);
        return results;
    } catch (err) {
        spinner.fail("Failed to fetch matches.");
        return [];
    }
}

async function getMatch(matchName) {
    const spinner = ora(`Searching for ${matchName}"...`).start();
    try {
        const result = await fetchMatchData(BASE_URL, matchName);
        spinner.succeed(`Found ${result.teams}.`);
        return result;
    } catch (err) {
        spinner.fail("Failed to fetch match.");
        return null;
    }
}

async function selectLink(links) {
    const linkOptions = links.map((link) => ({
        name: link.name,
        value: link,
    }));
    const selLnk = await inquirer.prompt([
        {   type: "list",
            name: "selectedLink",
            message: "Select a link:",
            choices: linkOptions }
    ]);
    return selLnk.selectedLink.link;
}

async function selectMatchPrompt() {
    const matches = await getAllMatches();
    if (!matches.length) {
        return null;
    }
    const matchOptions = matches.map((match) => ({
        name: match.teams,
        value: match,
    }));
    const selMtch = await inquirer.prompt([
        {   type: "list",
            name: "selectedMatch",
            message: "Select a match:",
            choices: matchOptions },
    ]);
    return selMtch.selectedMatch;
}

async function enterMatchPrompt() {
    let cache = await loadCache();
    const { matchQuery } = await inquirer.prompt([
        {   type: "input",
            name: "matchQuery",
            message: "Enter match (<home> vs <away>):" },
    ]);
    let match = cache[matchQuery] || await getMatch(matchQuery);
    if (!match) {
        return null;
    }
    cache[matchQuery] = match;
    await saveCache(cache);
    return match;
}

async function selectOption(options) {
    const { selectedOption } = await inquirer.prompt([
        {
            type: "list",
            name: "selectedOption",
            message: "Select an option: ",
            choices: options,
        }
    ]);
    return selectedOption;
}

function playWithMPV(videoUrl) {
    console.log(chk.green("Streaming:", videoUrl));
    const mpv = spawn("mpv", [videoUrl], { stdio: ["ignore", "ignore", "ignore"] });

    // When Node.js is closing, kill mpv
    process.on("SIGINT", () => {
    console.log(chk.red("\nCancelled by user."));
    mpv.kill("SIGINT"); // Send SIGINT to mpv
    process.exit(1); // Exit Node.js
    });
}

// CLI Workflow
async function main() {
    const options = [
        "\t1. Enter a match",
        "\t2. Select a match",
        "\t3. Exit",
    ];
    const selectedOption = await selectOption(options);
    var selectedMatch = {};

    switch(selectedOption) {
        case options[0]:
            selectedMatch = await enterMatchPrompt();
            if (!selectedMatch) {
                console.log(chk.red(`No match found.`));
                return;
            }
            break;
        case options[1]:
            selectedMatch = await selectMatchPrompt();
            if (!selectedMatch) {
                console.log(chk.red("No match found."));
                return;
            }
            break;
        case options[2]:
            return;
        }

    const matchLinks = selectedMatch.links;
    const selectedLink = await selectLink(matchLinks);
    let videoUrl = await getVideoSource(selectedLink);

    if (!videoUrl) {
        console.log(chk.red("Failed to fetch video source."));
        return;
    }
    playWithMPV(videoUrl);
}

// CLI Command Setup
program
    .description("Search and watch a football match")
    .action(main);

program.parse(process.argv);
