(()=>{
  "use strict";
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const num=value=>Number(value||0).toLocaleString();
  const DEFINITIONS={
    players:[
      {id:"battles_100",name:"Century Challenger",description:"Recorded results in 100 official battles.",criteria:"100 battles",metric:"tournaments_played",threshold:100,icon:"100"},
      {id:"battles_200",name:"Double Century",description:"Recorded results in 200 official battles.",criteria:"200 battles",metric:"tournaments_played",threshold:200,icon:"200"},
      {id:"battles_400",name:"Battle Marathon",description:"Recorded results in 400 official battles.",criteria:"400 battles",metric:"tournaments_played",threshold:400,icon:"400"},
      {id:"battles_600",name:"Ultra Veteran",description:"Recorded results in 600 official battles.",criteria:"600 battles",metric:"tournaments_played",threshold:600,icon:"600"},
      {id:"podiums_25",name:"Podium Specialist",description:"Finished in the top three at least 25 times.",criteria:"25 podiums",metric:"podiums",threshold:25,icon:"25×"},
      {id:"podiums_50",name:"Podium Elite",description:"Finished in the top three at least 50 times.",criteria:"50 podiums",metric:"podiums",threshold:50,icon:"50×"},
      {id:"podiums_100",name:"Podium Legend",description:"Finished in the top three at least 100 times.",criteria:"100 podiums",metric:"podiums",threshold:100,icon:"100"},
      {id:"podiums_300",name:"Podium Immortal",description:"Finished in the top three at least 300 times.",criteria:"300 podiums",metric:"podiums",threshold:300,icon:"300"},
      {id:"wins_10",name:"10-Time Champion",description:"Won at least 10 official battles.",criteria:"10 wins",metric:"first_places",threshold:10,icon:"10 W"},
      {id:"wins_25",name:"Grand Champion",description:"Won at least 25 official battles.",criteria:"25 wins",metric:"first_places",threshold:25,icon:"25 W"},
      {id:"wins_50",name:"Supreme Champion",description:"Won at least 50 official battles.",criteria:"50 wins",metric:"first_places",threshold:50,icon:"50 W"},
      {id:"wins_75",name:"Ultra Champion",description:"Won at least 75 official battles.",criteria:"75 wins",metric:"first_places",threshold:75,icon:"75 W"},
      {id:"streak_8",name:"Podium Momentum",description:"Reached the podium in eight consecutive numbered battles.",criteria:"8 consecutive podiums",metric:"longest_podium_streak",threshold:8,icon:"8×"},
      {id:"streak_10",name:"Unbroken Momentum",description:"Reached the podium in 10 consecutive numbered battles.",criteria:"10 consecutive podiums",metric:"longest_podium_streak",threshold:10,icon:"10×"},
      {id:"streak_12",name:"Unstoppable Run",description:"Reached the podium in 12 consecutive numbered battles.",criteria:"12 consecutive podiums",metric:"longest_podium_streak",threshold:12,icon:"12×"},
      {id:"streak_15",name:"Perfect Podium Run",description:"Reached the podium in 15 consecutive numbered battles.",criteria:"15 consecutive podiums",metric:"longest_podium_streak",threshold:15,icon:"15×"}
    ],
    teams:[
      {id:"battles_300",name:"Established Club",description:"Recorded results in 300 official battles.",criteria:"300 battles",metric:"tournaments_played",threshold:300,icon:"300"},
      {id:"battles_400",name:"Veteran Club",description:"Recorded results in 400 official battles.",criteria:"400 battles",metric:"tournaments_played",threshold:400,icon:"400"},
      {id:"battles_500",name:"Elite Institution",description:"Recorded results in 500 official battles.",criteria:"500 battles",metric:"tournaments_played",threshold:500,icon:"500"},
      {id:"battles_600",name:"600-Battle Institution",description:"Recorded results in 600 official battles.",criteria:"600 battles",metric:"tournaments_played",threshold:600,icon:"600"},
      {id:"podiums_50",name:"Podium Contender",description:"Finished in the top three at least 50 times.",criteria:"50 podiums",metric:"podiums",threshold:50,icon:"50×"},
      {id:"podiums_150",name:"Podium Dynasty",description:"Finished in the top three at least 150 times.",criteria:"150 podiums",metric:"podiums",threshold:150,icon:"150"},
      {id:"podiums_250",name:"Podium Empire",description:"Finished in the top three at least 250 times.",criteria:"250 podiums",metric:"podiums",threshold:250,icon:"250"},
      {id:"podiums_400",name:"Four-Hundred Podiums",description:"Finished in the top three at least 400 times.",criteria:"400 podiums",metric:"podiums",threshold:400,icon:"400"},
      {id:"wins_10",name:"10-Time Team Champion",description:"Won at least 10 official battles.",criteria:"10 wins",metric:"first_places",threshold:10,icon:"10 W"},
      {id:"wins_25",name:"Dominant Team",description:"Won at least 25 official battles.",criteria:"25 wins",metric:"first_places",threshold:25,icon:"25 W"},
      {id:"wins_50",name:"Team Dynasty",description:"Won at least 50 official battles.",criteria:"50 wins",metric:"first_places",threshold:50,icon:"50 W"},
      {id:"wins_100",name:"Century of Victories",description:"Won at least 100 official battles.",criteria:"100 wins",metric:"first_places",threshold:100,icon:"100 W"},
      {id:"streak_10",name:"Unbroken Team Form",description:"Reached the podium in 10 consecutive numbered battles.",criteria:"10 consecutive podiums",metric:"longest_podium_streak",threshold:10,icon:"10×"},
      {id:"streak_20",name:"Elite Consistency",description:"Reached the podium in 20 consecutive numbered battles.",criteria:"20 consecutive podiums",metric:"longest_podium_streak",threshold:20,icon:"20×"},
      {id:"streak_30",name:"Thirty-Battle Reign",description:"Reached the podium in 30 consecutive numbered battles.",criteria:"30 consecutive podiums",metric:"longest_podium_streak",threshold:30,icon:"30×"},
      {id:"streak_40",name:"Forty-Battle Reign",description:"Reached the podium in 40 consecutive numbered battles.",criteria:"40 consecutive podiums",metric:"longest_podium_streak",threshold:40,icon:"40×"}
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