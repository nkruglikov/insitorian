const fs = require("fs");
const path = require("path");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/CNAME");
  eleventyConfig.addPassthroughCopy("src/monocle.png");
  eleventyConfig.addPassthroughCopy("src/favicon-32x32.png");
  eleventyConfig.addWatchTarget("src/_data/voting.csv");

  const playersPath = path.join(__dirname, "src/_data/players.json");

  function loadPlayers() {
    return JSON.parse(fs.readFileSync(playersPath, "utf-8"));
  }

  function playerHtml(name, p) {
    return `<span class="relative cursor-pointer underline decoration-dotted decoration-stone-400 dark:decoration-stone-500 underline-offset-2 group" onclick="navigator.clipboard.writeText('${p.ticker}');var t=this.querySelector('span');t.dataset.orig=t.dataset.orig||t.textContent;t.textContent='Copied ${p.ticker}';setTimeout(function(){t.textContent=t.dataset.orig},1000);this.blur()">${name}<span class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 rounded text-xs font-sans font-normal whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity bg-stone-50 dark:bg-stone-900 text-stone-500 dark:text-stone-400 border border-stone-300 dark:border-stone-700 shadow-sm pointer-events-none">${p.company} | ${p.ticker}</span></span>`;
  }

  eleventyConfig.addShortcode("player", function (name) {
    const players = loadPlayers();
    const key = Object.keys(players).find(k => k.toLowerCase() === name.toLowerCase());
    const p = key ? players[key] : null;
    if (!p) return name;
    return playerHtml(name, p);
  });

  eleventyConfig.addFilter("linkPlayers", function (text) {
    const players = loadPlayers();
    for (const [name, p] of Object.entries(players)) {
      text = text.replace(new RegExp(`\\b${name}\\b`, "g"), playerHtml(name, p));
    }
    return text;
  });

  eleventyConfig.addPairedShortcode("zh", function(content) {
    const ps = content.trim().split(/\n\n+/)
      .map((p, i) => {
        const cls = i > 0 ? ' class="mt-3"' : '';
        return `<p${cls}>${p.replace(/\n/g, "").trim()}</p>`;
      }).join("\n");
    return `\n<div class="lang-zh hidden">${ps}</div>\n`;
  });

  eleventyConfig.amendLibrary("md", mdLib => {
    mdLib.renderer.rules.heading_open = function(tokens, idx, options, env, self) {
      if (tokens[idx].tag === 'h2') {
        tokens[idx].attrJoin('class',
          'text-xl font-bold border-t border-stone-300 dark:border-stone-700 pt-4 mt-8 mb-4');
        env._prevType = 'heading';
      }
      return self.renderToken(tokens, idx, options);
    };

    mdLib.renderer.rules.paragraph_open = function(tokens, idx, options, env, self) {
      const inline = tokens[idx + 1];
      const children = inline?.children;
      let isQuestion = false;
      if (inline?.type === 'inline' && children?.length >= 3) {
        const meaningful = children.filter(c => !(c.type === 'text' && c.content.trim() === ''));
        isQuestion = meaningful.length >= 3
          && meaningful[0].type === 'strong_open'
          && meaningful[meaningful.length - 1].type === 'strong_close';
      }

      if (isQuestion) {
        tokens[idx].attrJoin('class', 'mt-6 mb-2');
        env._prevType = 'question';
      } else {
        if (env._prevType === 'answer') {
          tokens[idx].attrJoin('class', 'mt-3');
        }
        env._prevType = 'answer';
      }
      return self.renderToken(tokens, idx, options);
    };
  });

  return {
    dir: {
      input: "src",
      output: "_site",
    },
  };
};
