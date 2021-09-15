#!/usr/bin/env node

let fs     = require("fs"),
    path   = require("path"),
    yargs  = require("yargs"),
    semver = require("semver"),
    exec   = require("child_process").exec,

    has_pkg_json = fs.existsSync(path.join(process.cwd(),"package.json")),
    has_cmp_json = fs.existsSync(path.join(process.cwd(),"composer.json")),
    pkg = has_pkg_json ? require(path.join(process.cwd(),"package.json")) : 
        (has_cmp_json ? require(path.join(process.cwd(),"composer.json")) : {}),
    has_rc_config = fs.existsSync(path.join(process.cwd(),".changelogrc")),

    defaults = {
      file      : "./CHANGELOG.md",
      page      : null, // "./changelog.html",
      link      : pkg.homepage ? pkg.homepage : null,
      jira      : null, // jira URL
      verbose   : false,
      latestonly: false,
      output    : false,
      json      : false
    },
    rcConfig   = has_rc_config ? require(path.join(process.cwd(),".changelogrc")) : {},

    out        = "";

let options = Object.assign({}, defaults);
options = pkg.changelog ? Object.assign(options, pkg.changelog) : options;
options = has_rc_config ? Object.assign(options, rcConfig) : options;
options = yargs.argv ? Object.assign(options, yargs.argv) : options;

if (pkg.homepage) {
  let dir = (pkg.homepage.includes("bitbucket") ? "/commits/" : "/commit/");
  commitURI = pkg.homepage + dir;
}

let verbose = options.verbose;
//console.log('options: ', options);

let errMsg = "";
errMsg += "+-------------------------------------------+\n";
errMsg += "| There was an error creating the changelog |\n";
errMsg += "+-------------------------------------------+\n";

// reads git-log output
// hands over one large 'text' of log-lines to promise resolver
function getCommits() {
  return new Promise((resolve, reject) => {
    exec("git log --topo-order --full-history --simplify-merges --date=short --format=\"%cd~>%d~>%H~>%s~>%p\"", (err, commits) => {
      if (err) {
        return reject(err);
      }

      resolve(commits);
    });
  });
}

// splits the log line-by-line
// returns list of log-lines
function splitCommits(commits) {
  return Promise.resolve(commits.trim().split("\n"));
}

// parses the log-line into entry properties
// transfers to a list of commit data objects
function formatCommits(commits) {
  let prevParent;

  return Promise.resolve(commits.map(commit => {
    let [date, refNames, hash, subject, parents] = commit.split("~>"),
        mergeCommitStart = false,
        mergeCommitEnd = false,
        validTag,
        tag,
        jira;

    if (refNames && refNames.includes("tag:")) {
      validTag = refNames.match(/tag: v?(\d{1,}\.\d{1,}\.\d{1,}[^,)]*)/);

      if (validTag) {
        tag = validTag[1].trim();
      }
    } else {
      tag = null;
    }

    if (parents && parents.includes(" ")) {
      mergeCommitStart = true;
      prevParent = parents.slice(0, parents.indexOf(" "));
      subject = subject.replace(/^Merge branch '(.+?)'.*/, "Implement '$1'");
      subject = subject.replace(/^Merge '(.+?)'.*/, "Implement '$1'");
      subject = subject.replace(/^Merged in (.+?\/[A-Z]+\-\d{1,}).*/, "Implement '$1'");
    } else if (hash == prevParent) {
      mergeCommitEnd = true;
    }

    var jiraTag = subject.match(/(([A-Z]+)[\-](\d{1,}))/);
    if (jiraTag) {
    	jira = jiraTag[0]
    } else {
    	jira = null
    }

    subject = encodeHTML(subject);

    return {date, tag, hash, subject, mergeCommitStart, mergeCommitEnd, jira};
  }));
}

// encode some special characters for HTML output
function encodeHTML(subject) {
  return subject
    .replace(/&/g, "&amp;")         // Encode ampersands
    .replace(/</g, "&lt;")          // Encode less-than symbols
    .replace(/"/g, "&quot;")        // Encode quotation marks
    .replace(/\\$/, "\\\\")         // Escape back-slash if it's the last char
    //.replace(/]/g, "\\]")           // Escape all right-brackets
    .replace(/]]/g, "]\\]")         // Escape right-brackets inside markdown link
    .replace(/(?!.*])\[/g, "&#91;") // Encode left-brackets (if no right-brackets are present)
    .replace(/`/g, "\\`");          // Escape back-ticks
}

// set indention-flag for child-commits
function flagIndention(formattedCommits) {
  return Promise.resolve(formattedCommits.map((commit, i) => {
    if (i > 0) {
      let prevCommit = formattedCommits[i - 1];

      if (commit.tag || commit.mergeCommitStart || commit.mergeCommitEnd) {
        commit.indent = false;
      } else if (prevCommit.mergeCommitStart || prevCommit.indent) {
        commit.indent = true;
      } else {
        commit.indent = false;
      }
    } else {
      commit.indent = false;
    }

    return commit;
  }));
}

// output header
function setHeader(formattedCommits) {
  out = "## Changelog\n";

  return Promise.resolve(formattedCommits);
}

// determin latest tag (first commit in log) version
function handleFirstCommitVersion(formattedCommits) {
  return new Promise((resolve, reject) => {
    exec("git log --tags -1 --format=\"%d\"", (err, commit) => {
      if (err) {
        return reject(err);
      }

      let pkgVers = pkg.version,
          tag,
          latestTag = '0.0.0';

      tag = commit.match(/tag: v?(\d{1,}\.\d{1,}\.\d{1,}[^,)]*)/);

      if (tag) {
        latestTag = tag[1].trim();
      }

      if (semver.lt(pkgVers, latestTag)) {
        console.log(`Your package version (${pkgVers}) has a SemVer value that falls before your latest tag (${latestTag}).`)
        /*return reject(`Your package version (${pkgVers}) has a SemVer value that falls before your latest tag (${latestTag}).`);*/
      }

      if (!formattedCommits[0].tag) {
        out += `\n### ${semver.gte(pkgVers, latestTag) ? ""+pkgVers+" (latest)" : pkgVers} (${getToday()})\n\n`;
      }

      resolve(formattedCommits);
    });
  });
}

// format today's date
function getToday() {
  let date = new Date();

  return `${date.getFullYear()}-${prepend0(date.getMonth() + 1)}-${prepend0(date.getDate())}`;
}

// prepend zeros "0" to single digits
function prepend0(val) {
  return (val < 10 ? "0" + val : val);
}

// assemble log markdown output
function prepareOutput(formattedCommits) {
  var latest = false;
  var reseted = false;
  var verbose = options.verbose && (String(options.verbose).trim() != 'false');
  formattedCommits.forEach((commit, idx) => {
    // first entry/tag and 'latest-only' option selected...
    // so set 'latest' flag: "we are showing latest entries only"
    if (idx == 0) {
      latest = (options.latestonly);
    }

    // ...we went on and suddenly another tag occured...
    if ((idx > 0) && commit.tag) {
      // so un-set the 'latest' flag
      latest = false;
    }

    if (latest || !options.latestonly) {
      if (commit.tag) {
          out += `\n### ${commit.tag} (${commit.date})\n\n`;
      }

      if (verbose && commit.indent) {
        out += "  ";
      }

      if ( (!commit.indent) || (verbose && commit.indent) ) {
        if (options.link) {
          let dir = (options.link.includes("bitbucket") ? "/commits/" : "/commit/");
          out += `- ${commit.subject} - [\[GIT\]](${(options.link+dir+commit.hash)})`;
        } else {
          out += `- ${commit.subject}`;
        }

        if (commit.jira && options.jira) {
      	  out += ` - [\[JIRA\]](${(options.jira+"/"+commit.jira)})`;
        }
	      out += `\n`;
      }
    }

  });

  return Promise.resolve();
}

// print output to console
function consoleOutput() {
  return new Promise((resolve, reject) => {
    if (options.output || (String(options.file).trim() == 'stdout') || (String(options.file).trim() == 'false')) {
      if (!options.json) {
        console.log(out);
      } else {
        console.log(json.stringify(json.parse(out)));
      }
    }
    resolve();
  });
}

// save output to file
function saveLogFile() {
  return new Promise((resolve, reject) => {
    if (!options.file || (String(options.file).trim() == 'stdout') || (String(options.file).trim() == 'false')) {
      resolve()
    } else {
      fs.writeFile(options.file, out, err => {
        if (err) {
          return reject(err);
        }

        resolve();
      });
    }
  });
}

// save output to html (page) file for to be converted via 'panini'
function saveHTMLpage() {
  return new Promise((resolve, reject) => {
    if (!options.file || (String(options.file).trim() == 'stdout') || (String(options.file).trim() == 'false')) {
      resolve()
    } else if (!options.page || (String(options.page).trim() == 'false')) {
      resolve()
    } else {
      let MarkdownRenderer = require('marked');

      let htmlLog = [
        '<article class="lib-article row columns" id="top">',
          '<section class="lib-section">',
            '<div data-changelog-view>',
                MarkdownRenderer(out),
            '</div>',
          '</section>',
        '<article>'
      ].join("\n")

      fs.writeFile(options.page, htmlLog, err => {
        if (err) {
          return reject(err);
        }

        resolve();
      });
    }
  });
}

getCommits()
  .then(splitCommits)
  .then(formatCommits)
  .then(flagIndention)
  .then(setHeader)
  .then(handleFirstCommitVersion)
  .then(prepareOutput)
  .then(consoleOutput)
  .then(saveLogFile)
  .then(saveHTMLpage)
  .catch(err => {

    console.error("\x1b[31m%s\x1b[0m", errMsg);
    console.error("\x1b[31m%s\x1b[0m\n", err);

    process.exit(1);
  });
