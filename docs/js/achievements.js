(()=>{
  "use strict";
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const num=value=>Number(value||0).toLocaleString();
  const DEFINITIONS={
    players:[
      {id:"first_steps",name:"Battle Regular",description:"Recorded results in 10 official battles.",criteria:"10 battles",metric:"tournaments_played",threshold:10,icon:"10+"},
      {id:"battle_veteran",name:"Battle Veteran",description:"Recorded results in 50 official battles.",criteria:"50 battles",metric:"tournaments_played",threshold:50,icon:"50+"},
      {id:"century_club",name:"Century Club",description:"Recorded results in 100 official battles.",criteria:"100 battles",metric:"tournaments_played",threshold:100,icon:"100"},
      {id:"podium_finisher",name:"Podium Finisher",description:"Finished in the top three at least five times.",criteria:"5 podiums",metric:"podiums",threshold:5,icon:"TOP 3"},
      {id:"podium_collector",name:"Podium Collector",description:"Finished in the top three at least 25 times.",criteria:"25 podiums",metric:"podiums",threshold:25,icon:"25×"},
      {id:"multi_champion",name:"Multiple Champion",description:"Won at least five official battles.",criteria:"5 wins",metric:"first_places",threshold:5,icon:"★"},
      {id:"podium_streak",name:"Podium Streak",description:"Reached the podium in five consecutive numbered battles.",criteria:"5 consecutive podiums",metric:"longest_podium_streak",threshold:5,icon:"STREAK"}
    ],
    teams:[
      {id:"first_steps",name:"Active Team",description:"Recorded results in 10 official battles.",criteria:"10 battles",metric:"tournaments_played",threshold:10,icon:"10+"},
      {id:"battle_veteran",name:"Veteran Team",description:"Recorded results in 50 official battles.",criteria:"50 battles",metric:"tournaments_played",threshold:50,icon:"50+"},
      {id:"century_club",name:"Century Club",description:"Recorded results in 100 official battles.",criteria:"100 battles",metric:"tournaments_played",threshold:100,icon:"100"},
      {id:"podium_finisher",name:"Podium Team",description:"Finished in the top three at least five times.",criteria:"5 podiums",metric:"podiums",threshold:5,icon:"TOP 3"},
      {id:"podium_collector",name:"Podium Dynasty",description:"Finished in the top three at least 25 times.",criteria:"25 podiums",metric:"podiums",threshold:25,icon:"25×"},
      {id:"multi_champion",name:"Championship Team",description:"Won at least five official battles.",criteria:"5 wins",metric:"first_places",threshold:5,icon:"★"},
      {id:"podium_streak",name:"Unbroken Form",description:"Reached the podium in five consecutive numbered battles.",criteria:"5 consecutive podiums",metric:"longest_podium_streak",threshold:5,icon:"STREAK"}
    ]
  };
  async function getJson(path){
    const response=await fetch(path,{cache:"no-cache"});
    if(!response.ok)throw new Error("Could not load "+path+" ("+response.status+")");
    return response.json();
  }
  function profileUrl(kind,id){
    return "./profile.html?type="+(kind==="teams"?"team":"player")+"&id="+encodeURIComponent(String(id||""));
  }
  function deriveCatalog(players,teams){
    const categories={},leaders={};
    for(const [kind,rows,idField,nameField] of [
      ["players",players,"username","username"],
      ["teams",teams,"team_id","team_name"]
    ]){
      categories[kind]=DEFINITIONS[kind].map(definition=>{
        const holders=rows.filter(row=>Number(row[definition.metric]||0)>=definition.threshold)
          .sort((a,b)=>(Number(b[definition.metric])||0)-(Number(a[definition.metric])||0)
            ||(Number(b.tournaments_played)||0)-(Number(a.tournaments_played)||0)
            ||String(a[nameField]||"").localeCompare(String(b[nameField]||"")));
        return {...definition,count:holders.length,holders:holders.slice(0,8).map(row=>({
          id:row[idField],name:row[nameField],rank:row.rank,points:row.points,value:row[definition.metric]
        }))};
      });
      const decorated=rows.map(row=>({...row,earned:DEFINITIONS[kind].filter(def=>Number(row[def.metric]||0)>=def.threshold)}));
      decorated.sort((a,b)=>b.earned.length-a.earned.length
        ||(Number(b.points)||0)-(Number(a.points)||0)
        ||String(a[nameField]||"").localeCompare(String(b[nameField]||"")));
      leaders[kind]=decorated.filter(row=>row.earned.length).slice(0,10).map(row=>({
        id:row[idField],name:row[nameField],rank:row.rank,points:row.points,achievement_count:row.earned.length
      }));
    }
    return {
      summary:{
        players_with_achievements:players.filter(row=>DEFINITIONS.players.some(def=>Number(row[def.metric]||0)>=def.threshold)).length,
        teams_with_achievements:teams.filter(row=>DEFINITIONS.teams.some(def=>Number(row[def.metric]||0)>=def.threshold)).length,
        player_badges_awarded:players.reduce((sum,row)=>sum+DEFINITIONS.players.filter(def=>Number(row[def.metric]||0)>=def.threshold).length,0),
        team_badges_awarded:teams.reduce((sum,row)=>sum+DEFINITIONS.teams.filter(def=>Number(row[def.metric]||0)>=def.threshold).length,0)
      },
      categories,leaders,generated_at:""
    };
  }
  async function load(){
    try{
      return await getJson("./data/achievements.json");
    }catch(error){
      // The page can use the current leaderboard immediately, before the next
      // scheduled full refresh has generated the compact achievements index.
      const [players,teams]=await Promise.all([
        getJson("./data/leaderboard_players.json"),
        getJson("./data/leaderboard_teams.json")
      ]);
      return deriveCatalog(Array.isArray(players)?players:[],Array.isArray(teams)?teams:[]);
    }
  }
  function renderSummary(data){
    const s=data.summary||{};
    $("achievement-summary").innerHTML=[
      ["Player badges awarded",s.player_badges_awarded],
      ["Teams with badges",s.teams_with_achievements],
      ["Player profiles awarded",s.players_with_achievements],
      ["Team badges awarded",s.team_badges_awarded]
    ].map(([label,value])=>'<article class="achievement-summary-card"><span>'+esc(label)+'</span><strong>'+num(value)+'</strong></article>').join("");
  }
  function renderCategory(data,kind,target){
    const rows=data.categories?.[kind]||[];
    $(target).innerHTML=rows.map(item=>{
      const holders=(item.holders||[]).map(holder=>'<div class="achievement-holder"><a href="'+esc(profileUrl(kind,holder.id))+'">'+esc(holder.name||holder.id)+'</a><strong>'+num(holder.value)+'</strong></div>').join("");
      return '<article class="achievement-card"><div class="achievement-card-head"><span class="achievement-card-icon">'+esc(item.icon||"★")+'</span><div><h3>'+esc(item.name)+'</h3><span class="achievement-criteria">'+esc(item.criteria)+'</span></div></div><p>'+esc(item.description)+'</p><div class="achievement-card-footer"><span>'+num(item.count)+' awarded</span><span>Top holders</span></div><div class="achievement-holders">'+(holders||'<span class="achievement-holder">No holders yet</span>')+'</div></article>';
    }).join("")||'<div class="achievement-loading">No achievements are available yet.</div>';
  }
  function renderLeaders(data,kind,target){
    const rows=data.leaders?.[kind]||[];
    $(target).innerHTML=rows.map((row,index)=>'<div class="achievement-leader"><span>#'+(index+1)+'</span><a href="'+esc(profileUrl(kind,row.id))+'">'+esc(row.name||row.id)+'</a><strong>'+num(row.achievement_count)+' badges</strong></div>').join("")||'<p class="achievement-loading">No awarded badges yet.</p>';
  }
  load().then(data=>{
    renderSummary(data);
    renderCategory(data,"players","player-achievements");
    renderCategory(data,"teams","team-achievements");
    renderLeaders(data,"players","player-achievement-leaders");
    renderLeaders(data,"teams","team-achievement-leaders");
    $("achievement-updated").textContent=data.generated_at
      ?"Achievement index refreshed "+new Date(data.generated_at).toLocaleString()
      :"Showing achievements calculated from the currently published leaderboard.";
  }).catch(error=>{
    console.error("Could not load achievement data",error);
    $("achievement-summary").innerHTML='<div class="achievement-loading">Achievement data is currently unavailable.</div>';
    $("player-achievements").innerHTML='<div class="achievement-loading">The achievement index could not be loaded.</div>';
    $("team-achievements").innerHTML='<div class="achievement-loading">The achievement index could not be loaded.</div>';
    $("player-achievement-leaders").innerHTML="";
    $("team-achievement-leaders").innerHTML="";
    $("achievement-updated").textContent=error.message||"Achievement data is not available.";
  });
})();