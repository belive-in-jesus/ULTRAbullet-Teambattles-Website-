(()=>{"use strict";
const $=id=>document.getElementById(id);
const params=new URLSearchParams(window.location.search);
const type=params.get("type")==="team"?"team":"player";
const requestedId=(params.get("id")||"").trim();
const state={entry:null,history:[],periods:null,period:"all",specific:"",query:"",page:1,pageSize:25,filtered:[],chartRange:25,chartMode:"score"};
const number=v=>Number(v||0).toLocaleString(undefined,{maximumFractionDigits:1});
const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const initialLetter=value=>{const text=String(value??"").trim();const match=text.match(/[\p{L}\p{N}]/u);return (match?match[0]:Array.from(text)[0]||"?").toUpperCase();};
const formatDate=v=>{if(v===null||v===undefined||v==="")return"Not available";const d=new Date(Number(v));return Number.isNaN(d.getTime())?"Not available":d.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"});};
async function load(path){const response=await fetch(path,{cache:"no-cache"});if(!response.ok)throw new Error("Could not load "+path+" ("+response.status+")");return response.json();}
function profileBucket(id){return String(id).trim().toLowerCase().replace(/[^a-z0-9]/g,"_")[0]||"_";}
function leaderboardPath(){return type==="team"?"./data/leaderboard_teams.json":"./data/leaderboard_players.json";}
function idField(){return type==="team"?"team_id":"username";}
function normalizeId(id){return String(id||"").trim().toLowerCase();}
async function resolveEntry(){
  const key=normalizeId(requestedId);
  if(!key)return null;
  const bucket=profileBucket(key);
  try{
    const directory=await load("./data/profiles/index/"+(type==="team"?"teams":"players")+"-"+bucket+".json");
    if(directory&&directory[key])return directory[key];
  }catch(error){console.info("Profile directory not published yet; using compatibility lookup.",error);}
  const rows=await load(leaderboardPath());
  return Array.isArray(rows)?rows.find(row=>normalizeId(row[idField()])===key)||null:null;
}
function battleNumber(record){
  const match=String(record.name||"").match(/^\s*(\d+)(?:st|nd|rd|th)\s+ultrabullet\s+/i);
  return match?Number(match[1]):null;
}
function seasonNumber(record){const n=battleNumber(record);return n?Math.floor((n-1)/50)+1:null;}
function filteredHistoryForStats(){
  let rows=[...state.history];
  if(state.period==="month"&&state.specific)rows=rows.filter(record=>record.startsAt&&new Date(Number(record.startsAt)).toISOString().slice(0,7)===state.specific);
  else if(state.period==="season"&&state.specific)rows=rows.filter(record=>String(seasonNumber(record))===state.specific);
  else if(state.period.startsWith("last"))rows=rows.slice(0,Number(state.period.slice(4))||10);
  return rows;
}
function filteredHistory(){
  const query=state.query.trim().toLocaleLowerCase();
  return filteredHistoryForStats().filter(record=>!query||String(record.name||"").toLocaleLowerCase().includes(query));
}
function longestPodiumStreak(rows){
  const byBattle=new Map();
  rows.forEach(row=>{const n=battleNumber(row),rank=Number(row.rank);if(n&&Number.isFinite(rank))byBattle.set(n,rank);});
  if(!byBattle.size)return 0;
  let current=0,longest=0;
  for(let n=Math.min(...byBattle.keys());n<=Math.max(...byBattle.keys());n++){
    const rank=byBattle.get(n);
    if(rank!==undefined&&rank>=1&&rank<=3){current++;longest=Math.max(longest,current);}else current=0;
  }
  return longest;
}
function metrics(rows){
  const points=rows.reduce((sum,row)=>sum+(Number(row.score)||0),0);
  const ranks=rows.map(row=>Number(row.rank)).filter(value=>Number.isFinite(value)&&value>0);
  const podiums=ranks.filter(rank=>rank<=3).length;
  const best=rows.reduce((winner,row)=>(Number(row.score)||0)>(Number(winner?.score)||0)?row:winner,null);
  return {
    tournaments_played:rows.length,points,avg_points:rows.length?points/rows.length:0,
    best_tournament_score:best?Number(best.score)||0:0,
    first_places:ranks.filter(rank=>rank===1).length,podiums,
    top3_rate:ranks.length?podiums/ranks.length:0,
    best_finish:ranks.length?Math.min(...ranks):null,
    avg_finish:ranks.length?ranks.reduce((sum,value)=>sum+value,0)/ranks.length:null,
    active_since:rows.length?Math.min(...rows.map(row=>Number(row.startsAt)||Infinity)):null,
    longest_podium_streak:longestPodiumStreak(rows)
  };
}

const ACHIEVEMENT_LABELS={
  battles_100:{name:type==="team"?"Century Challenger":"Century Challenger",description:"Recorded results in 100 official battles.",icon:"100"},
  battles_200:{name:type==="team"?"Double Century":"Double Century",description:"Recorded results in 200 official battles.",icon:"200"},
  battles_400:{name:type==="team"?"Veteran Club":"Battle Marathon",description:"Recorded results in 400 official battles.",icon:"400"},
  battles_600:{name:type==="team"?"600-Battle Institution":"Ultra Veteran",description:"Recorded results in 600 official battles.",icon:"600"},
  podiums_25:{name:type==="team"?"Podium Specialist":"Podium Specialist",description:"Finished in the top three at least 25 times.",icon:"25×"},
  podiums_50:{name:type==="team"?"Podium Contender":"Podium Elite",description:"Finished in the top three at least 50 times.",icon:"50×"},
  podiums_100:{name:type==="team"?"Podium Dynasty":"Podium Legend",description:"Finished in the top three at least 100 times.",icon:"100"},
  podiums_150:{name:"Podium Dynasty",description:"Finished in the top three at least 150 times.",icon:"150"},
  podiums_250:{name:"Podium Empire",description:"Finished in the top three at least 250 times.",icon:"250"},
  podiums_300:{name:"Podium Immortal",description:"Finished in the top three at least 300 times.",icon:"300"},
  wins_10:{name:type==="team"?"10-Time Team Champion":"10-Time Champion",description:"Won at least 10 official battles.",icon:"10 W"},
  wins_25:{name:type==="team"?"Dominant Team":"Grand Champion",description:"Won at least 25 official battles.",icon:"25 W"},
  wins_50:{name:type==="team"?"Team Dynasty":"Supreme Champion",description:"Won at least 50 official battles.",icon:"50 W"},
  wins_75:{name:type==="team"?"Ultra Champion":"Ultra Champion",description:"Won at least 75 official battles.",icon:"75 W"},
  streak_8:{name:type==="team"?"Podium Momentum":"Podium Momentum",description:"Reached the podium in eight consecutive numbered battles.",icon:"8×"},
  streak_10:{name:type==="team"?"Unbroken Team Form":"Unbroken Momentum",description:"Reached the podium in 10 consecutive numbered battles.",icon:"10×"},
  streak_12:{name:type==="team"?"Unstoppable Run":"Unstoppable Run",description:"Reached the podium in 12 consecutive numbered battles.",icon:"12×"},
  streak_15:{name:type==="team"?"Perfect Podium Run":"Perfect Podium Run",description:"Reached the podium in 15 consecutive numbered battles.",icon:"15×"},
  battles_300:{name:type==="team"?"Established Club":"Established Club",description:"Recorded results in 300 official battles.",icon:"300"},
  battles_500:{name:type==="team"?"Elite Institution":"Elite Institution",description:"Recorded results in 500 official battles.",icon:"500"},
  podiums_400:{name:type==="team"?"Four-Hundred Podiums":"Four-Hundred Podiums",description:"Finished in the top three at least 400 times.",icon:"400"},
  wins_100:{name:type==="team"?"Century of Victories":"Century of Victories",description:"Won at least 100 official battles.",icon:"100 W"},
  streak_20:{name:type==="team"?"Elite Consistency":"Elite Consistency",description:"Reached the podium in 20 consecutive numbered battles.",icon:"20×"},
  streak_30:{name:type==="team"?"Thirty-Battle Reign":"Thirty-Battle Reign",description:"Reached the podium in 30 consecutive numbered battles.",icon:"30×"},
  streak_40:{name:type==="team"?"Forty-Battle Reign":"Forty-Battle Reign",description:"Reached the podium in 40 consecutive numbered battles.",icon:"40×"}
};
function renderAchievements(){
  const row=state.entry||{};
  const definitions=type==="team"?[
    ["battles_300","tournaments_played",300],
    ["battles_400","tournaments_played",400],
    ["battles_500","tournaments_played",500],
    ["battles_600","tournaments_played",600],
    ["podiums_50","podiums",50],
    ["podiums_150","podiums",150],
    ["podiums_250","podiums",250],
    ["podiums_400","podiums",400],
    ["wins_10","first_places",10],
    ["wins_25","first_places",25],
    ["wins_50","first_places",50],
    ["wins_100","first_places",100],
    ["streak_10","longest_podium_streak",10],
    ["streak_20","longest_podium_streak",20],
    ["streak_30","longest_podium_streak",30],
    ["streak_40","longest_podium_streak",40]
  ]:[
    ["battles_100","tournaments_played",100],
    ["battles_200","tournaments_played",200],
    ["battles_400","tournaments_played",400],
    ["battles_600","tournaments_played",600],
    ["podiums_25","podiums",25],
    ["podiums_50","podiums",50],
    ["podiums_100","podiums",100],
    ["podiums_300","podiums",300],
    ["wins_10","first_places",10],
    ["wins_25","first_places",25],
    ["wins_50","first_places",50],
    ["wins_75","first_places",75],
    ["streak_8","longest_podium_streak",8],
    ["streak_10","longest_podium_streak",10],
    ["streak_12","longest_podium_streak",12],
    ["streak_15","longest_podium_streak",15]
  ];
  const earned=definitions.filter(([,metric,threshold])=>Number(row[metric]||0)>=threshold).map(([id])=>id);
  if(!earned.length){
    $("profile-achievements").innerHTML='<div class="profile-empty">No career badges earned yet. Achievement thresholds are based on the all-time record.</div>';
    return;
  }
  $("profile-achievements").innerHTML=earned.map(id=>{
    const item=ACHIEVEMENT_LABELS[id];
    if(!item)return "";
    return '<article class="achievement-badge-card"><span class="achievement-badge-icon">'+escapeHtml(item.icon)+'</span><span class="achievement-badge-copy"><strong>'+escapeHtml(item.name)+'</strong><small>'+escapeHtml(item.description)+'</small></span></article>';
  }).join("");
}
function renderMemberStatistics(profile){
  const isTeam=type==="team";
  $("member-stat-title").textContent=isTeam?"Top team contributors":"Recorded team affiliations";
  $("member-stat-description").textContent=isTeam
    ?"Players listed in this team's historical Lichess team-battle standings, with their recorded contributions."
    :"Teams in whose historical Lichess team-battle standings this player was listed, with the recorded contribution.";
  const rows=isTeam?(Array.isArray(profile.members)?profile.members:[]):(Array.isArray(profile.teams)?profile.teams:[]);
  const subject=isTeam?"Player":"Team";
  $("member-stat-head").innerHTML='<tr><th>'+subject+'</th><th class="number-cell">Battles listed</th><th class="number-cell">Contribution pts</th><th class="number-cell">Avg / battle</th><th>Last seen</th></tr>';
  if(!rows.length){
    $("member-stat-summary").textContent="No contributor snapshots are published for this profile yet.";
    $("member-stat-rows").innerHTML='<tr><td colspan="5" class="profile-empty">These statistics will be populated by the next successful full data refresh. Lichess exposes the players listed in each team standing; this is not a complete team roster.</td></tr>';
    return;
  }
  const total=rows.reduce((sum,row)=>sum+(Number(row.battles_listed)||0),0);
  $("member-stat-summary").textContent=rows.length+" "+(isTeam?"listed contributors":"recorded teams")+" · "+number(total)+" listed battle appearances";
  $("member-stat-rows").innerHTML=rows.map(row=>{
    const id=String(row.id||"");
    const href="./profile.html?type="+(isTeam?"player":"team")+"&id="+encodeURIComponent(id);
    const label=String(row.name||id||"Unknown");
    return '<tr><td><div class="member-profile-identity"><span class="member-profile-mark" aria-hidden="true">'+escapeHtml(initialLetter(label))+'</span><a class="member-profile-link" href="'+escapeHtml(href)+'">'+escapeHtml(label)+'</a></div></td><td class="number-cell">'+number(row.battles_listed)+'</td><td class="number-cell">'+number(row.contribution_points)+'</td><td class="number-cell">'+number(row.avg_contribution)+'</td><td>'+escapeHtml(formatDate(row.last_seen))+'</td></tr>';
  }).join("");
}

function buildPerformanceIndexHistoryMarkup(checkpoints){
  const rows=(Array.isArray(checkpoints)?checkpoints:[])
    .map(item=>({
      battle:Number(item?.[0]),
      cumulative:Number(item?.[1]),
      cumulativeBattles:Number(item?.[2])||0,
      seasonal:item?.[3]==null?null:Number(item[3]),
      seasonalBattles:Number(item?.[4])||0,
      rank:item?.[5]==null?null:Number(item[5])
    }))
    .filter(item=>Number.isFinite(item.battle)&&item.battle>0&&Number.isFinite(item.cumulative))
    .sort((a,b)=>a.battle-b.battle);
  if(!rows.length)return '<div class="pi-history-empty">Historical PI checkpoints will be available after the next successful full statistics refresh.</div>';

  const width=960,height=250,left=58,right=24,top=22,bottom=44;
  const plotWidth=width-left-right,plotHeight=height-top-bottom;
  const minBattle=rows[0].battle,maxBattle=rows[rows.length-1].battle;
  const xFor=battle=>left+(maxBattle===minBattle?plotWidth/2:(battle-minBattle)/(maxBattle-minBattle)*plotWidth);
  const yFor=value=>top+(100-Math.max(0,Math.min(100,value)))/100*plotHeight;
  const grid=[0,50,100].map(value=>{
    const y=yFor(value);
    return '<g><line x1="'+left+'" y1="'+y.toFixed(1)+'" x2="'+(width-right)+'" y2="'+y.toFixed(1)+'" stroke="rgba(151,178,203,.16)" stroke-dasharray="3 7"/><text x="'+(left-12)+'" y="'+(y+4).toFixed(1)+'" text-anchor="end" class="analytics-axis-label">'+value+'</text></g>';
  }).join("");
  const points=rows.map(item=>({...item,season:Math.floor((item.battle-1)/50)+1,x:xFor(item.battle),y:yFor(item.cumulative)}));
  const path=points.map((point,index)=>{
    const previous=points[index-1];
    return (!previous||point.season!==previous.season+1?"M":"L")+point.x.toFixed(1)+" "+point.y.toFixed(1);
  }).join(" ");
  const line='<path d="'+path+'" fill="none" stroke="#70e2e8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
  const circles=points.map(point=>'<circle cx="'+point.x.toFixed(1)+'" cy="'+point.y.toFixed(1)+'" r="5" fill="#b19cff" stroke="#101c2d" stroke-width="2"><title>After Battle '+point.battle+' · Cumulative PI '+point.cumulative.toFixed(1)+' · Season PI '+(point.seasonal==null?"not eligible":point.seasonal.toFixed(1))+' · Career PI rank '+(point.rank==null?"provisional":"#"+point.rank)+'</title></circle>').join("");
  const labels=points.map(point=>'<text x="'+point.x.toFixed(1)+'" y="'+(height-14)+'" text-anchor="middle" class="analytics-axis-label">S'+point.season+'</text>').join("");
  const svg='<svg class="pi-history-svg" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Historical cumulative Performance Index from zero to one hundred">'+grid+line+circles+labels+'</svg>';
  const table=rows.slice().reverse().map(row=>{
    const season=Math.floor((row.battle-1)/50)+1;
    const seasonValue=row.seasonal==null?"—":row.seasonal.toFixed(1);
    const eligibility=row.seasonalBattles>=10?"Official":"Provisional";
    return '<tr><td>Season '+season+'</td><td class="number-cell">#'+row.battle+'</td><td class="number-cell">'+row.cumulative.toFixed(1)+'</td><td class="number-cell">'+(row.rank==null?"—":"#"+row.rank)+'</td><td class="number-cell">'+seasonValue+'</td><td class="number-cell">'+row.seasonalBattles+'</td><td>'+eligibility+'</td></tr>';
  }).join("");
  return '<div class="pi-history-block"><div class="pi-history-heading"><div><strong>Historical PI development</strong><span>Cumulative index at the end of each active season</span></div><small>'+rows.length+' checkpoints</small></div><div class="pi-history-chart">'+svg+'</div><div class="pi-history-table-wrap"><table class="pi-history-table"><thead><tr><th>Season</th><th class="number-cell">Checkpoint</th><th class="number-cell">Career PI</th><th class="number-cell">Career PI rank</th><th class="number-cell">Season PI</th><th class="number-cell">Season battles</th><th>Status</th></tr></thead><tbody>'+table+'</tbody></table></div><p class="pi-history-note">Career PI uses all ranked results up to the checkpoint. Season PI uses only that season’s results and is official from 10 ranked battles. Seasons without a recorded result are omitted.</p></div>';
}

function renderPerformanceIndex(){
  const target=$("profile-pi-card");
  const row=state.entry||{};
  if(row.performance_index===undefined){
    target.innerHTML='<div class="pi-profile-empty">Performance Index data will appear after the next successful full statistics refresh.</div>';
    return;
  }
  const value=row.performance_index;
  const eligible=Boolean(row.performance_index_eligible)&&row.performance_index_rank!=null;
  const components=row.performance_index_components||{};
  const componentRows=[
    ["Average performance",components.average_performance,"40%"],
    ["Consistency",components.consistency,"25%"],
    ["Recent performance",components.recent_performance,"20%"],
    ["Participation",components.participation,"15%"]
  ];
  const format=value=>value==null?"—":Number(value).toFixed(1);
  const componentMarkup=componentRows.map(([label,score,weight])=>
    '<div class="pi-profile-component"><div><span>'+escapeHtml(label)+'</span><strong>'+format(score)+'</strong></div><div class="pi-profile-track"><i style="width:'+Math.max(0,Math.min(100,Number(score)||0))+'%"></i></div><small>'+weight+' weight</small></div>'
  ).join("");
  const status=eligible
    ?'<span class="pi-profile-status">Official PI rank · #'+escapeHtml(row.performance_index_rank)+'</span>'
    :'<span class="pi-profile-status provisional">Provisional · '+escapeHtml(row.performance_index_battles||0)+' / 10 ranked battles</span>';
  target.innerHTML='<div class="pi-profile-main"><div><span class="pi-profile-label">PERFORMANCE INDEX</span><strong class="pi-profile-value">'+format(value)+'</strong><span class="pi-profile-scale">out of 100</span></div><div class="pi-profile-meta">'+status+'<p>Based on '+escapeHtml(row.performance_index_battles||0)+' valid ranked battle results. The PI is independent of cumulative points.</p><a href="./performance-index.html">How the index works ↗</a></div></div><div class="pi-profile-components">'+componentMarkup+'</div>'+buildPerformanceIndexHistoryMarkup(row.performance_index_history);
}
function renderStats(){
  const m=metrics(filteredHistoryForStats());
  $("stat-points").textContent=number(m.points);
  $("stat-battles").textContent=number(m.tournaments_played);
  $("stat-average").textContent=number(m.avg_points);
  $("stat-podiums").textContent=number(m.podiums);
  $("stat-podium-caption").textContent=number(m.first_places)+" first places · top-three finishes";
  $("stat-points-caption").textContent=state.period==="all"?"Cumulative score":"Score in selected period";
  $("profile-period-caption").textContent=state.period==="all"?"All recorded battles":$("history-period").selectedOptions[0]?.textContent||"Selected period";
  const fields=[
    ["Best battle score",m.best_tournament_score??m.best_score,"Points"],
    ["Best finish",m.best_finish==null?"—":"#"+number(m.best_finish),"Highest recorded tournament finish"],
    ["Average finish",m.avg_finish==null?"—":"#"+number(m.avg_finish),"Across recorded finishes"],
    ["First places",m.first_places,"Tournament wins"],
    ["Podium rate",((Number(m.top3_rate)||0)*100).toFixed(1)+"%","Top-three finishes"],
    ["Longest podium streak",number(m.longest_podium_streak),"Consecutive numbered battles with a top-three finish"],
    ["Active since",formatDate(m.active_since),"First recorded result"]
  ];
  $("profile-records").innerHTML=fields.map(([label,value,caption])=>'<article class="profile-record"><span>'+escapeHtml(label)+'</span><strong>'+escapeHtml(value??"—")+'</strong><small>'+escapeHtml(caption)+'</small></article>').join("");
}
function buildRankHistorySvg(checkpoints){
  const rows=(Array.isArray(checkpoints)?checkpoints:[])
    .map(item=>({battle:Number(item?.[0]),rank:Number(item?.[1])}))
    .filter(item=>Number.isFinite(item.battle)&&item.battle>0&&Number.isFinite(item.rank)&&item.rank>0)
    .sort((a,b)=>a.battle-b.battle);
  if(!rows.length)return '<div class="profile-empty">Cumulative rank history will appear after the next successful data refresh.</div>';

  const width=960,height=278,left=66,right=24,top=25,bottom=52;
  const plotWidth=width-left-right,plotHeight=height-top-bottom;
  const maxRank=Math.max(1,...rows.map(item=>item.rank));
  const axisMax=Math.max(3,Math.ceil(maxRank/10)*10);
  const minBattle=rows[0].battle,maxBattle=rows[rows.length-1].battle;
  const xFor=battle=>left+(maxBattle===minBattle?plotWidth/2:(battle-minBattle)/(maxBattle-minBattle)*plotWidth);
  const yFor=rank=>top+(rank-1)/(axisMax-1||1)*plotHeight;
  const ticks=[...new Set([1,Math.max(2,Math.round(axisMax/2)),axisMax])];
  const grid=ticks.map(rank=>{
    const y=yFor(rank);
    return '<g><line x1="'+left+'" y1="'+y.toFixed(1)+'" x2="'+(width-right)+'" y2="'+y.toFixed(1)+'" stroke="rgba(151,178,203,.16)" stroke-dasharray="3 7"/><text x="'+(left-12)+'" y="'+(y+4).toFixed(1)+'" text-anchor="end" class="analytics-axis-label">#'+number(rank)+'</text></g>';
  }).join("");
  const points=rows.map(item=>({ ...item,season:Math.floor((item.battle-1)/50)+1,x:xFor(item.battle),y:yFor(item.rank) }));
  // Do not draw an implied trend across seasons in which the competitor has no recorded result.
  const path=points.map((point,index)=>{
    const previous=points[index-1];
    const command=!previous||point.season!==previous.season+1?"M":"L";
    return command+point.x.toFixed(1)+" "+point.y.toFixed(1);
  }).join(" ");
  const line='<path d="'+path+'" fill="none" stroke="#70e2e8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
  const circles=points.map(point=>'<circle cx="'+point.x.toFixed(1)+'" cy="'+point.y.toFixed(1)+'" r="5" fill="#b19cff" stroke="#101c2d" stroke-width="2"><title>After Battle '+point.battle+' · All-time rank #'+point.rank+' · Season '+point.season+'</title></circle>').join("");
  const labels=points.map(point=>'<text x="'+point.x.toFixed(1)+'" y="'+(height-19)+'" text-anchor="middle" class="analytics-axis-label">S'+point.season+'</text>').join("");
  return '<svg class="analytics-svg" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Cumulative all-time rank history. Lower rank numbers are better.">'+grid+line+circles+labels+'</svg>';
}
function renderChart(){
  const scoreButton=$("chart-mode-score"),rankButton=$("chart-mode-rank");
  const rangeWrap=$("trend-range-wrap"),secondaryLegend=$("chart-legend-secondary-wrap");
  if(scoreButton&&rankButton){
    if(state.chartMode==="rank"){
      scoreButton.classList.remove("active");rankButton.classList.add("active");
      scoreButton.setAttribute("aria-pressed","false");rankButton.setAttribute("aria-pressed","true");
    }else{
      rankButton.classList.remove("active");scoreButton.classList.add("active");
      rankButton.setAttribute("aria-pressed","false");scoreButton.setAttribute("aria-pressed","true");
    }
  }
  if(state.chartMode==="rank"){
    rangeWrap?.classList.add("hidden");
    secondaryLegend?.classList.add("hidden");
    $("chart-legend-primary").textContent="Cumulative all-time rank";
    const checkpoints=state.entry?.rank_history||[];
    $("chart-range").textContent=checkpoints.length
      ?"Season checkpoints · "+checkpoints.length+" recorded"
      :"No historical checkpoints";
    $("profile-chart").innerHTML=buildRankHistorySvg(checkpoints);
    $("profile-chart").setAttribute("aria-label","Cumulative all-time rank history");
    return;
  }

  rangeWrap?.classList.remove("hidden");
  secondaryLegend?.classList.remove("hidden");
  $("chart-legend-primary").textContent="Score per battle";
  $("chart-legend-secondary").textContent="Period average";
  const analytics=window.UBTAnalytics;
  if(!analytics){$("profile-chart").innerHTML='<div class="profile-empty">The analytics module could not be loaded.</div>';return;}
  const rows=analytics.chronological(filteredHistoryForStats());
  const limit=state.chartRange==="all"?null:Number(state.chartRange)||25;
  const visible=limit?rows.slice(-limit):rows;
  $("chart-range").textContent=visible.length?formatDate(visible[0].startsAt)+" – "+formatDate(visible[visible.length-1].startsAt):"No data";
  $("profile-chart").innerHTML=analytics.buildScoreTrendSvg(rows,limit);
  $("profile-chart").setAttribute("aria-label","Recent battle score chart");
}
function renderAnalytics(){
  const analytics=window.UBTAnalytics;
  if(!analytics)return;
  const rows=filteredHistoryForStats();
  const summary=analytics.summarize(rows);
  $("analytics-period-label").textContent=state.period==="all"?"ALL-TIME DATA":($("history-period").selectedOptions[0]?.textContent||"SELECTED PERIOD").toLocaleUpperCase();
  $("analytics-recent-average").textContent=summary.recentBattles?number(summary.recentAverage):"—";
  if(summary.recentBattles&&summary.avgPoints){
    const delta=summary.recentAverageDelta,verb=delta>0.005?"above":delta< -0.005?"below":"in line with";
    const prefix=delta>0?"+":"";
    $("analytics-average-delta").textContent=prefix+(delta*100).toFixed(1)+"% "+verb+" the selected-period average";
  }else $("analytics-average-delta").textContent="Not enough results for a comparison";
  $("analytics-recent-podium-rate").textContent=summary.recentRankedBattles?(summary.recentPodiumRate*100).toFixed(1)+"%":"—";
  $("analytics-recent-podium-caption").textContent=summary.recentRankedBattles?number(summary.recentPodiums)+" podiums from "+number(summary.recentRankedBattles)+" ranked battles":"No placement data in the latest results";
  $("analytics-latest-streak").textContent=summary.latestPodiumRun?number(summary.latestPodiumRun)+" battles":"—";
  $("analytics-ranked-count").textContent=number(summary.rankedBattles)+" ranked battles";
  $("analytics-donut").innerHTML=analytics.buildFinishDonutSvg(summary);
  const total=summary.rankedBattles;
  $("analytics-donut-legend").innerHTML=summary.rankCounts.map(item=>{
    const percentage=total?(item.count/total*100).toFixed(1)+"%":"0%";
    return '<div class="analytics-legend-row"><i style="--legend-color:'+item.color+'"></i><span>'+escapeHtml(item.label)+'</span><strong>'+number(item.count)+'</strong><small>'+percentage+'</small></div>';
  }).join("");
  $("analytics-monthly-chart").innerHTML=analytics.buildMonthlySvg(summary.months);
  $("analytics-monthly-summary").textContent=summary.bestMonth
    ?"Top month: "+summary.bestMonth.label+" · "+number(summary.bestMonth.points)+" points · "+number(summary.bestMonth.battles)+" battles"
    :"No monthly breakdown available";
  $("analytics-heatmap").innerHTML=analytics.buildActivityHeatmapSvg(rows);
  $("analytics-season-rows").innerHTML=analytics.buildSeasonRows(summary.seasons);
}
function renderHistory(){
  const rows=filteredHistory();state.filtered=rows;
  const total=rows.length,pageCount=Math.max(1,Math.ceil(total/state.pageSize));
  state.page=Math.max(1,Math.min(state.page,pageCount));
  const start=(state.page-1)*state.pageSize,visible=rows.slice(start,start+state.pageSize);
  $("history-summary").textContent=number(total)+" battles · "+(state.period==="all"?"all-time archive":$("history-period").selectedOptions[0]?.textContent||"selected period");
  $("history-page-summary").textContent=total?("Showing "+number(start+1)+"–"+number(Math.min(start+state.pageSize,total))+" of "+number(total)):"No battles found";
  $("history-page").textContent="Page "+state.page+" of "+pageCount;
  $("history-prev").disabled=state.page<=1;$("history-next").disabled=state.page>=pageCount;
  if(!visible.length){$("history-rows").innerHTML='<tr><td colspan="5" class="profile-empty">'+(state.history.length?"No battles match your search.":"No battle history is available for this competitor.")+'</td></tr>';return;}
  $("history-rows").innerHTML=visible.map(row=>{
    const n=battleNumber(row),href="https://lichess.org/tournament/"+encodeURIComponent(String(row.id||""));
    const finish=row.rank?("#"+number(row.rank)):"—";
    return '<tr><td><span class="battle-name">'+escapeHtml(row.name||"UltraBullet Team Battle")+'</span><span class="battle-number">'+(n?"Battle "+n:"Unnumbered battle")+'</span></td><td>'+escapeHtml(formatDate(row.startsAt))+'</td><td class="number-cell">'+escapeHtml(finish)+'</td><td class="number-cell">'+escapeHtml(number(row.score))+'</td><td><a href="'+href+'" target="_blank" rel="noopener noreferrer">Open ↗</a></td></tr>';
  }).join("");
}
function renderPeriodOptions(){
  const select=$("specific-period");select.innerHTML="";
  if(state.period==="month"){
    (state.periods?.months||[]).forEach(item=>{const option=document.createElement("option");option.value=item.key;option.textContent=item.label+" · "+number(item.battle_count)+" battles";select.appendChild(option);});
  }else if(state.period==="season"){
    (state.periods?.seasons||[]).forEach(item=>{const option=document.createElement("option");option.value=String(item.key).replace("season-","");option.textContent=item.label+(item.complete?"":" · in progress")+(item.missing_battle_numbers?.length?" · "+item.missing_battle_numbers.length+" missing":"");select.appendChild(option);});
  }
  if(select.options.length){state.specific=select.options[0].value;select.value=state.specific;$("specific-period-wrap").classList.remove("hidden");}
  else{$("specific-period-wrap").classList.add("hidden");state.specific="";}
}
function renderAll(){renderStats();renderPerformanceIndex();renderChart();renderAnalytics();renderHistory();}
async function init(){
  if(!requestedId){$("profile-name").textContent="Profile not found";$("profile-description").textContent="This profile URL is missing its competitor identifier.";return;}
  $("profile-kind").textContent=type==="team"?"TEAM PROFILE":"PLAYER PROFILE";
  const entry=await resolveEntry();
  if(!entry){$("profile-name").textContent="Competitor not found";$("profile-description").textContent="No matching competitor exists in the published leaderboard data.";$("profile-records").innerHTML='<div class="profile-empty">Check the profile link or return to the leaderboard.</div>';return;}
  state.entry=entry;
  const canonicalId=entry[idField()]||entry.id||requestedId;
  const displayName=type==="team"?(entry.team_name||entry.name||canonicalId):(entry.username||entry.name||canonicalId);
  document.title=displayName+" — UltraBullet Team Battles";
  $("profile-name").textContent=displayName;
  $("profile-initial").textContent=initialLetter(displayName);
  $("profile-description").textContent=type==="team"?"Historical team performance across the numbered ULTRAbullet Team Battles.":"Individual performance across the numbered ULTRAbullet Team Battles.";
  $("profile-rank").textContent="#"+number(entry.rank);
  $("profile-rank-caption").textContent=type==="team"?"All-time team ranking":"All-time player ranking";
  $("profile-last-active").textContent=formatDate(entry.last_played);
  $("lichess-profile-link").href=type==="team"?"https://lichess.org/team/"+encodeURIComponent(canonicalId):"https://lichess.org/@/"+encodeURIComponent(canonicalId);
  $("compare-profile-link").href="./compare.html?type="+(type==="team"?"team":"player")+"&a="+encodeURIComponent(canonicalId);
  $("share-profile").addEventListener("click",async()=>{
    try{await navigator.clipboard.writeText(window.location.href);$("profile-feedback").textContent="Profile link copied to clipboard.";}
    catch(error){$("profile-feedback").textContent="Copy is unavailable in this browser. Copy the page address from the address bar.";}
  });
  const [shard,periods]=await Promise.all([load("./data/"+entry.profile_file),load("./data/periods_index.json").catch(()=>null)]);
  const profile=shard&&shard[entry.profile_key];
  if(!profile||!Array.isArray(profile.history))throw new Error("The competitor's detailed history is not present in the published profile shard.");
  state.history=[...profile.history].sort((a,b)=>(Number(b.startsAt)||0)-(Number(a.startsAt)||0));
  state.periods=periods;
  renderAchievements();
  renderMemberStatistics(profile);
  $("chart-mode-score").addEventListener("click",()=>{state.chartMode="score";renderChart();});
  $("chart-mode-rank").addEventListener("click",()=>{state.chartMode="rank";renderChart();});
  $("trend-range").addEventListener("change",()=>{state.chartRange=$("trend-range").value;renderChart();});
  $("history-period").addEventListener("change",()=>{
    state.period=$("history-period").value;state.page=1;
    if(state.period==="month"||state.period==="season")renderPeriodOptions();
    else{$("specific-period-wrap").classList.add("hidden");state.specific="";}
    renderAll();
  });
  $("specific-period").addEventListener("change",()=>{state.specific=$("specific-period").value;state.page=1;renderAll();});
  $("history-search").addEventListener("input",()=>{state.query=$("history-search").value;state.page=1;renderHistory();});
  $("history-prev").addEventListener("click",()=>{if(state.page>1){state.page--;renderHistory();}});
  $("history-next").addEventListener("click",()=>{if(state.page<Math.ceil(state.filtered.length/state.pageSize)){state.page++;renderHistory();}});
  renderAll();
}
init().catch(error=>{
  console.error("Could not load profile",error);
  $("profile-name").textContent="Profile temporarily unavailable";
  $("profile-description").textContent="The profile data could not be loaded. Please return to the leaderboard and try again.";
  $("profile-records").innerHTML='<div class="profile-empty">'+escapeHtml(error.message||"An unexpected error occurred.")+'</div>';
  $("history-rows").innerHTML='<tr><td colspan="5" class="profile-empty">Battle history could not be loaded.</td></tr>';
});
})();