const fs = require("fs");
const path = require("path");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/monocle.png");
  eleventyConfig.addPassthroughCopy("src/favicon-32x32.png");
  eleventyConfig.addPassthroughCopy("src/voting_data.js");

  const players = JSON.parse(
    fs.readFileSync(path.join(__dirname, "src/_data/players.json"), "utf-8")
  );

  eleventyConfig.addShortcode("player", function (name) {
    const p = players[name];
    if (!p) return name;
    return `<span class="relative cursor-help border-b border-dotted border-stone-500 group" tabindex="0">${name}<span class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 rounded text-xs font-sans font-normal whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity bg-stone-50 dark:bg-stone-900 text-stone-500 dark:text-stone-400 border border-stone-300 dark:border-stone-700 shadow-sm pointer-events-none">${p.company} | ${p.ticker}</span></span>`;
  });

  return {
    dir: {
      input: "src",
      output: "_site",
    },
  };
};
