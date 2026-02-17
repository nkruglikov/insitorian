(function(){
  var DURATION_H = 7 * 24; // 168 hours
  var FONT = getComputedStyle(document.querySelector('.font-sans')).fontFamily;
  var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // Canonical team membership: player name → team key
  var TEAM_OF = {
    "Schaitr": "schaitr", "Filefolders": "schaitr", "PurpleOrange": "schaitr", "Tegridy": "schaitr",
    "Euu": "euu", "heiheihahei": "euu", "Tnn": "euu"
  };

  function colors(){
    var s = getComputedStyle(document.documentElement);
    return {
      line1:   s.getPropertyValue('--c-accent-warm').trim(),
      line2:   s.getPropertyValue('--c-accent-cool').trim(),
      neutral: s.getPropertyValue('--c-accent-mute').trim(),
      grid:    s.getPropertyValue('--c-grid').trim(),
      text:    s.getPropertyValue('--c-muted').trim(),
      tipBg:   s.getPropertyValue('--c-tooltip').trim()
    };
  }

  var TEAM_COLORS = { schaitr: "line1", euu: "line2" };

  function teamColor(name, c){
    var key = TEAM_OF[name];
    return key && TEAM_COLORS[key] ? c[TEAM_COLORS[key]] : c.neutral;
  }

  function teamKey(name){
    return TEAM_OF[name] || "neutral";
  }

  function draw(sel, planet){
    var c = colors();
    var container = document.querySelector(sel);
    var w = container.clientWidth;
    var chartH = Math.round(w * 0.8);
    var seatZone = 90;
    var h = chartH + seatZone;
    var m = {top:14,right:34,bottom:26,left:30};

    var svg = d3.select(sel).append("svg")
      .attr("viewBox","0 0 "+w+" "+h)
      .attr("preserveAspectRatio","xMidYMid meet");

    if(!planet.started){
      var startDate = new Date(planet.start);
      var now = new Date();
      var diffH = Math.max(0, Math.round((startDate - now) / 3600000));
      svg.append("text")
        .attr("x",w/2).attr("y",h/2)
        .attr("text-anchor","middle").attr("font-size","13px")
        .attr("font-family",FONT).attr("fill",c.text)
        .text("Starts in ~"+diffH+"h");
      return;
    }

    // Find candidates who appear in top 5 at any snapshot
    var snapshots = {};
    planet.series.forEach(function(s){
      s.data.forEach(function(d){
        if(!snapshots[d[0]]) snapshots[d[0]]=[];
        snapshots[d[0]].push({name:s.name, votes:d[1]});
      });
    });
    var visible = {};
    Object.keys(snapshots).forEach(function(h){
      var snap = snapshots[h].slice().sort(function(a,b){return b.votes-a.votes;});
      var cutoff = snap.length>=5 ? snap[4].votes : 0;
      for(var i=0;i<snap.length;i++){
        if(i<5 || (cutoff>0 && snap[i].votes>=cutoff)) visible[snap[i].name]=1;
      }
    });
    var lines = [];
    planet.series.forEach(function(s){
      if(!visible[s.name]) return;
      lines.push([s.data, teamColor(s.name,c), s.name]);
    });
    var all = [];
    lines.forEach(function(l){all=all.concat(l[0]);});
    var yMax = d3.max(all, function(d){return d[1];}) || 1;

    var x = d3.scaleLinear().domain([0, DURATION_H]).range([m.left, w-m.right]);
    var y = d3.scaleLinear().domain([0, yMax*1.15]).range([chartH-m.bottom, m.top]);

    // Section labels
    var votesLabel = svg.append("text")
      .attr("x",w/2).attr("y",m.top - 4)
      .attr("text-anchor","middle")
      .attr("font-size","12px").attr("font-family",FONT).attr("font-weight","700")
      .attr("text-transform","uppercase").attr("letter-spacing","0.05em")
      .attr("fill",c.text).text("Votes");
    svg.append("text")
      .attr("x",w/2).attr("y",chartH + 8)
      .attr("text-anchor","middle")
      .attr("font-size","12px").attr("font-family",FONT).attr("font-weight","700")
      .attr("text-transform","uppercase").attr("letter-spacing","0.05em")
      .attr("fill",c.text).text("Seats");

    // Grid
    svg.selectAll(".grid")
      .data(y.ticks(4))
      .join("line")
        .attr("x1",m.left).attr("x2",w-m.right)
        .attr("y1",function(d){return y(d);}).attr("y2",function(d){return y(d);})
        .attr("stroke",c.grid).attr("stroke-dasharray","2,3");

    // X axis - one tick per day, showing date
    var startMs = new Date(planet.start).getTime();
    var months = MONTHS;
    svg.append("g")
      .attr("transform","translate(0,"+(chartH-m.bottom)+")")
      .call(d3.axisBottom(x)
        .tickValues([0,24,48,72,96,120,144,168])
        .tickFormat(function(d){
          var dt = new Date(startMs + d*3600000);
          return dt.getDate();
        }))
      .call(function(g){g.select(".domain").attr("stroke",c.grid);})
      .call(function(g){g.selectAll(".tick text").attr("font-size","11px").attr("font-family",FONT).attr("fill",c.text);})
      .call(function(g){g.selectAll(".tick line").attr("stroke",c.grid);});

    // Month label on first tick
    var firstDt = new Date(startMs);
    svg.append("text")
      .attr("x",m.left).attr("y",chartH-2)
      .attr("font-size","11px").attr("font-family",FONT).attr("fill",c.text)
      .text(months[firstDt.getMonth()]);

    // Y axis
    svg.append("g")
      .attr("transform","translate("+m.left+",0)")
      .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format("d")))
      .call(function(g){g.select(".domain").remove();})
      .call(function(g){g.selectAll(".tick text").attr("font-size","11px").attr("font-family",FONT).attr("fill",c.text);})
      .call(function(g){g.selectAll(".tick line").remove();});

    var line = d3.line()
      .x(function(d){return x(d[0]);})
      .y(function(d){return y(d[1]);})
      .curve(d3.curveMonotoneX);

    // Lines: full paths (fade on hover) + clipped duplicates (solid up to hover point)
    var clipId = sel.replace("#","") + "-clip";
    var clipRect = svg.append("defs").append("clipPath").attr("id",clipId)
      .append("rect").attr("x",0).attr("y",0).attr("height",chartH).attr("width",0);
    var fullPaths = [];
    lines.forEach(function(l){
      if(!l[0].length) return;
      fullPaths.push(svg.append("path").datum(l[0])
        .attr("fill","none").attr("stroke",l[1]).attr("stroke-width",2).attr("d",line));
    });
    var clippedPaths = [];
    lines.forEach(function(l){
      if(!l[0].length) return;
      clippedPaths.push(svg.append("path").datum(l[0])
        .attr("fill","none").attr("stroke",l[1]).attr("stroke-width",2).attr("d",line)
        .attr("clip-path","url(#"+clipId+")")
        .style("display","none"));
    });

    // Dynamic end dots + labels
    var labelG = svg.append("g");
    function updateLabels(idx, showNumbers){
      labelG.selectAll("*").remove();
      var labelMap = {};
      lines.forEach(function(l){
        if(!l[0].length || !l[0][idx]) return;
        var pt = l[0][idx];
        var lx = x(pt[0]), ly = y(pt[1]);
        labelG.append("circle").attr("cx",lx).attr("cy",ly).attr("r",3).attr("fill",l[1]);
        var key = pt[1];
        if(!labelMap[key]) labelMap[key] = {lx:lx, ly:ly+3, entries:[]};
        labelMap[key].entries.push({name:l[2], col:l[1], v:pt[1]});
      });
      var groups = Object.keys(labelMap).map(function(k){return labelMap[k];});
      groups.sort(function(a,b){return a.ly-b.ly;});
      for(var i=1;i<groups.length;i++){
        if(groups[i].ly-groups[i-1].ly<10) groups[i].ly=groups[i-1].ly+10;
      }
      groups.forEach(function(g){
        var flipLeft = g.lx > w-70;
        var txt = labelG.append("text")
          .attr("x", flipLeft ? g.lx-6 : g.lx+6)
          .attr("y", g.ly)
          .attr("text-anchor", flipLeft ? "end" : "start")
          .attr("font-size","11px").attr("font-family",FONT)
          .attr("font-weight","600");
        g.entries.forEach(function(e,i){
          if(i>0) txt.append("tspan").attr("fill",c.text).text(", ");
          txt.append("tspan").attr("fill",e.col).text(showNumbers ? e.name+" "+e.v : e.name);
        });
      });
    }
    // Initial state: labels at last data point, no numbers
    var lastIdx = lines[0] && lines[0][0].length ? lines[0][0].length - 1 : 0;
    updateLabels(lastIdx, false);

    // Hover interaction
    var snapSet = {};
    all.forEach(function(d){snapSet[d[0]]=1;});
    var snapHours = Object.keys(snapSet).map(Number).sort(function(a,b){return a-b;});
    var hoverLine = svg.append("line")
      .attr("y1",m.top).attr("y2",chartH-m.bottom)
      .attr("stroke",c.text).attr("stroke-width",0.75)
      .attr("stroke-dasharray","3,3").style("opacity",0);
    var hoverDate = svg.append("text")
      .attr("font-size","11px").attr("font-family",FONT).attr("fill",c.text)
      .style("opacity",0);

    // Seat circles — drawn in main SVG below chart
    function top5AtSnapshot(hourKey){
      var snap = snapshots[hourKey];
      if(!snap) return [];
      return snap.slice().sort(function(a,b){return b.votes-a.votes;}).slice(0,5);
    }
    var seatR = 6;
    var rowH = seatR * 2 + 4;
    var seatG = svg.append("g");

    function updateSeats(top5){
      seatG.selectAll("*").remove();
      // Group by faction
      var factions = {};
      top5.forEach(function(s){
        var k = teamKey(s.name);
        if(!factions[k]) factions[k] = [];
        factions[k].push(s);
      });
      // Sort factions largest first
      var groups = Object.keys(factions).map(function(k){return factions[k];});
      groups.sort(function(a,b){return b.length - a.length;});

      // Layout: columns side by side, dots stacked vertically
      var colW = (w - m.left - m.right) / groups.length;
      groups.forEach(function(g, gi){
        var colX = m.left + colW * gi + colW / 2;
        g.forEach(function(s, si){
          var cy = chartH + 22 + seatR + si * rowH;
          var col = teamColor(s.name, c);
          seatG.append("circle")
            .attr("cx", colX - 30).attr("cy", cy).attr("r", seatR).attr("fill", col);
          seatG.append("text")
            .attr("x", colX - 30 + seatR + 6).attr("y", cy)
            .attr("dominant-baseline", "central")
            .attr("text-anchor", "start")
            .attr("font-size","12px").attr("font-family",FONT)
            .attr("font-weight","600").attr("fill", col)
            .text(s.name);
        });
      });
    }
    var lastSnap = snapHours[snapHours.length-1];
    updateSeats(top5AtSnapshot(lastSnap));

    // Use HTML overlay for reliable touch handling
    var overlay = document.createElement("div");
    overlay.style.cssText = "position:absolute;top:0;left:0;width:100%;height:"+(chartH/h*100)+"%;touch-action:pan-y";
    container.style.position = "relative";
    container.appendChild(overlay);

    var pointerActive = false, startX = 0, startY = 0, locked = false, hoverSticky = false;
    overlay.addEventListener("pointerdown",function(e){
      startX = e.clientX; startY = e.clientY;
      pointerActive = true; locked = false;
      hoverSticky = false;
    });
    document.addEventListener("pointerdown",function(e){
      if(hoverSticky && e.target !== overlay){
        hoverSticky = false;
        onLeave();
      }
    });
    overlay.addEventListener("pointermove",function(e){
      if(!pointerActive && e.pointerType !== "mouse") return;
      if(e.pointerType === "mouse"){
        doHover(e); return;
      }
      if(!locked){
        var dx = Math.abs(e.clientX - startX);
        var dy = Math.abs(e.clientY - startY);
        if(dx < 4 && dy < 4) return;
        if(dx > dy){ locked = true; hoverSticky = false; overlay.setPointerCapture(e.pointerId); overlay.style.touchAction = "none"; }
        else{ pointerActive = false; return; }
      }
      doHover(e);
    });
    overlay.addEventListener("pointerup",function(e){
      if(e.pointerType !== "mouse"){
        if(!locked){
          // Tap: show hover at tap position and stick
          doHover(e);
        }
        hoverSticky = true;
      }
      pointerActive = false; locked = false;
      overlay.style.touchAction = "pan-y";
    });
    overlay.addEventListener("pointerleave",function(e){
      if(e.pointerType === "mouse") onLeave();
    });

    function doHover(e){
      var svgRect = container.querySelector("svg").getBoundingClientRect();
      var svgX = (e.clientX - svgRect.left) / svgRect.width * w;
      onHover(x.invert(svgX));
    }

    function onHover(hoverH){
      var nearest = snapHours.reduce(function(a,b){
        return Math.abs(b-hoverH)<Math.abs(a-hoverH)?b:a;
      });
      var idx = snapHours.indexOf(nearest);
      var hx = x(nearest);
      hoverLine.attr("x1",hx).attr("x2",hx).style("opacity",1);

      var dt = new Date(startMs + nearest*3600000);
      var dateStr = dt.getDate()+" "+months[dt.getMonth()]+" "+
        String(dt.getHours()).padStart(2,"0")+":"+String(dt.getMinutes()).padStart(2,"0");
      var rightSide = hx > w/2;
      hoverDate
        .attr("x", rightSide ? hx-4 : hx+4)
        .attr("y", m.top + 10)
        .attr("text-anchor", rightSide ? "end" : "start")
        .text(dateStr).style("opacity",1);

      // Fade full paths, clip solid duplicates to hover point
      clipRect.attr("width", x(nearest));
      fullPaths.forEach(function(p){p.attr("opacity",0.2);});
      clippedPaths.forEach(function(p){p.style("display",null);});

      // Update labels to hover point with numbers
      updateLabels(idx, true);

      updateSeats(top5AtSnapshot(nearest));
    }
    function onLeave(){
      hoverLine.style("opacity",0);
      hoverDate.style("opacity",0);

      // Restore full paths, hide clipped duplicates
      fullPaths.forEach(function(p){p.attr("opacity",1);});
      clippedPaths.forEach(function(p){p.style("display","none");});

      // Restore labels to end, no numbers
      updateLabels(lastIdx, false);

      updateSeats(top5AtSnapshot(lastSnap));
    }
  }

  function drawAll(){
    ["chart-promitor","chart-avalon","chart-boucher"].forEach(function(id){
      document.getElementById(id).innerHTML = "";
    });
    draw("#chart-promitor", votingData.promitor);
    draw("#chart-avalon",   votingData.avalon);
    draw("#chart-boucher",  votingData.boucher);
  }

  drawAll();
  window._drawAllCharts = drawAll;
})();
