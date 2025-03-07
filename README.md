# Football-CLI
<div align="justify">Football-CLI is a simple and lightweight command-line interface (CLI) tool for streaming football matches directly from your terminal. Inspired by ani-cli, but built entirely with Node.js for ease of installation and cross-platform compatibility. Below are the features, installation process and general usage.</div>

## Table of Contents
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
  - [Search for a football match](#search-for-a-football-match)
  - [List available matches](#list-available-matches)
  - [Stream a match](#stream-a-match)
- [Dependencies](#dependencies)
- [Contributing](#contributing)
- [License](#license)

## Features
- Stream live football matches directly in your terminal
- Search for match by title
- Fetch episodes from [here](https://www.rojadirectaenvivo.pl/)

## Installation

Ensure you have [Node.js](https://nodejs.org/) (version 14 or later) installed.

```sh
npm install -g @r1712k/football-cli
```

## Usage

### Search for a football match
```sh
football-cli
```
- Enter match

### List available matches
```sh
football-cli
```
- Select match

### Stream a match
```sh
football-cli
```
- Select match <Selected match>
- Select a link (Preferably an HD one)

## Dependencies
- Node.js
- [chalk](https://www.npmjs.com/package/chalk) for terminal styling
- [commander](https://www.npmjs.com/package/commander) for the CLI
- [fs-extra](https://www.npmjs.com/package/fs-extra) for additional file system methods
- [inquirer](https://www.npmjs.com/package/inquirer) for interactive prompts
- [ora](https://www.npmjs.com/package/ora) for terminal spinners
- [puppeteer](https://www.npmjs.com/package/puppeteer) for the scrapping process
- [random-useragent](https://www.npmjs.com/package/random-useragent) for random user agents
- [mpv](https://mpv.io/) for media playback

## Contributing
Pull requests are welcome! Feel free to submit issues and suggest features.

## License
This project is licensed under the ISC License.
