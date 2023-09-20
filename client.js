//var Color = importNamespace('PixelCombats.ScriptingApi.Structures');
//var System = importNamespace('System');

// êîíñòàíòû
var WaitingPlayersTime = 1;
var BuildBaseTime = 3;
var GameModeTime = 60;
var EndOfMatchTime = 100;

// êîíñòàíòû èìåí
var WaitingStateValue = "Waiting";
var BuildModeStateValue = "BuildMode";
var GameStateValue = "Game";
var EndOfMatchStateValue = "EndOfMatch";

// ïîñòîÿííûå ïåðåìåííûå
var mainTimer = Timers.GetContext().Get("Main");
var stateProp = Properties.GetContext().Get("State");

// ïðèìåíÿåì ïàðàìåòðû ñîçäàíèÿ êîìíàòû
Damage.FriendlyFire = GameMode.Parameters.GetBool("FriendlyFire");
Map.Rotation = GameMode.Parameters.GetBool("MapRotation");
BreackGraph.OnlyPlayerBlocksDmg = GameMode.Parameters.GetBool("PartialDesruction");
BreackGraph.WeakBlocks = GameMode.Parameters.GetBool("LoosenBlocks");

// áëîê èãðîêà âñåãäà óñèëåí
BreackGraph.PlayerBlockBoost = true;

// ïàðàìåòðû èãðû
Properties.GetContext().GameModeName.Value = "GameModes/Team Dead Match";
TeamsBalancer.IsAutoBalance = true;
Ui.GetContext().MainTimerId.Value = mainTimer.Id;
// ñîçäàåì êîìàíäû
Teams.Add("Blue", "Teams/Blue", { b: 1 });
Teams.Add("Red", "Teams/Red", { r: 1 });
var blueTeam = Teams.Get("Blue");
var redTeam = Teams.Get("Red");
blueTeam.Spawns.SpawnPointsGroups.Add(1);
redTeam.Spawns.SpawnPointsGroups.Add(2);
blueTeam.Build.BlocksSet.Value = BuildBlocksSet.Blue;
redTeam.Build.BlocksSet.Value = BuildBlocksSet.Red;

// çàäàåì ìàêñ ñìåðòåé êîìàíä
var maxDeaths = Players.MaxCount * 5;
Teams.Get("Red").Properties.Get("Deaths").Value = maxDeaths;
Teams.Get("Blue").Properties.Get("Deaths").Value = maxDeaths;
// çàäàåì ÷òî âûâîäèòü â ëèäåðáîðäàõ
LeaderBoard.PlayerLeaderBoardValues = [
	{
		Value: "Kills",
		DisplayName: "Statistics/Kills",
		ShortDisplayName: "Statistics/KillsShort"
	},
	{
		Value: "Deaths",
		DisplayName: "Statistics/Deaths",
		ShortDisplayName: "Statistics/DeathsShort"
	},
	{
		Value: "Spawns",
		DisplayName: "Statistics/Spawns",
		ShortDisplayName: "Statistics/SpawnsShort"
	},
	{
		Value: "Scores",
		DisplayName: "Statistics/Scores",
		ShortDisplayName: "Statistics/ScoresShort"
	}
];
LeaderBoard.TeamLeaderBoardValue = {
	Value: "Deaths",
	DisplayName: "Statistics\Deaths",
	ShortDisplayName: "Statistics\Deaths"
};
// âåñ êîìàíäû â ëèäåðáîðäå
LeaderBoard.TeamWeightGetter.Set(function(team) {
	return team.Properties.Get("Deaths").Value;
});
// âåñ èãðîêà â ëèäåðáîðäå
LeaderBoard.PlayersWeightGetter.Set(function(player) {
	return player.Properties.Get("Kills").Value;
});

// çàäàåì ÷òî âûâîäèòü ââåðõó
Ui.GetContext().TeamProp1.Value = { Team: "Blue", Prop: "Deaths" };
Ui.GetContext().TeamProp2.Value = { Team: "Red", Prop: "Deaths" };

// ðàçðåøàåì âõîä â êîìàíäû ïî çàïðîñó
Teams.OnRequestJoinTeam.Add(function(player,team){team.Add(player);});
// ñïàâí ïî âõîäó â êîìàíäó
Teams.OnPlayerChangeTeam.Add(function(player){ player.Spawns.Spawn()});

// äåëàåì èãðîêîâ íåóÿçâèìûìè ïîñëå ñïàâíà
var immortalityTimerName="immortality";
Spawns.GetContext().OnSpawn.Add(function(player){
	player.Properties.Immortality.Value=true;
	timer=player.Timers.Get(immortalityTimerName).Restart(5);
});
Timers.OnPlayerTimer.Add(function(timer){
	if(timer.Id!=immortalityTimerName) return;
	timer.Player.Properties.Immortality.Value=false;
});

// ïîñëå êàæäîé ñìåðòè èãðîêà îòíèìàåì îäíó ñìåðòü â êîìàíäå
Properties.OnPlayerProperty.Add(function(context, value) {
	if (value.Name !== "Deaths") return;
	if (context.Player.Team == null) return;
	context.Player.Team.Properties.Get("Deaths").Value--;
});
// åñëè â êîìàíäå êîëè÷åñòâî ñìåðòåé çàíóëèëîñü òî çàâåðøàåì èãðó
Properties.OnTeamProperty.Add(function(context, value) {
	if (value.Name !== "Deaths") return;
	if (value.Value <= 0) SetEndOfMatchMode();
});

// ñ÷åò÷èê ñïàâíîâ
Spawns.OnSpawn.Add(function(player) {
	++player.Properties.Spawns.Value;
});
// ñ÷åò÷èê ñìåðòåé
Damage.OnDeath.Add(function(player) {
	++player.Properties.Deaths.Value;
});
// ñ÷åò÷èê óáèéñòâ
Damage.OnKill.Add(function(player, killed) {
	if (killed.Team != null && killed.Team != player.Team) {
		++player.Properties.Kills.Value;
		player.Properties.Scores.Value += 100;
	}
});

// íàñòðîéêà ïåðåêëþ÷åíèÿ ðåæèìîâ
mainTimer.OnTimer.Add(function() {
	switch (stateProp.Value) {
	case WaitingStateValue:
		SetBuildMode();
		break;
	case BuildModeStateValue:
		SetGameMode();
		break;
	case GameStateValue:
		SetEndOfMatchMode();
		break;
	case EndOfMatchStateValue:
		RestartGame();
		break;
	}
});

// çàäàåì ïåðâîå èãðîâîå ñîñòîÿíèå
SetWaitingMode();

// ñîñòîÿíèÿ èãðû
function SetWaitingMode() {
	stateProp.Value = WaitingStateValue;
	Ui.GetContext().Hint.Value = "Hint/WaitingPlayers";
	Spawns.GetContext().enable = false;
	mainTimer.Restart(WaitingPlayersTime);
}

function SetBuildMode() 
{
	stateProp.Value = BuildModeStateValue;
	Ui.GetContext().Hint.Value = "Hint/BuildBase";
	var inventory = Inventory.GetContext();
	inventory.Main.Value = false;
	inventory.Secondary.Value = false;
	inventory.Melee.Value = true;
	inventory.Explosive.Value = false;
	inventory.Build.Value = true;

	mainTimer.Restart(BuildBaseTime);
	Spawns.GetContext().enable = true;
	SpawnTeams();
}
function SetGameMode() 
{
	stateProp.Value = GameStateValue;
	Ui.GetContext().Hint.Value = "Hint/AttackEnemies";

	var inventory = Inventory.GetContext();
	if (GameMode.Parameters.GetBool("OnlyKnives")) {
		inventory.Main.Value = false;
		inventory.Secondary.Value = false;
		inventory.Melee.Value = true;
		inventory.Explosive.Value = false;
		inventory.Build.Value = true;
	} else {
		inventory.Main.Value = true;
		inventory.Secondary.Value = true;
		inventory.Melee.Value = true;
		inventory.Explosive.Value = true;
		inventory.Build.Value = true;
	}

	mainTimer.Restart(GameModeTime);
	Spawns.GetContext().Despawn();
	SpawnTeams();
}
function SetEndOfMatchMode() {
	stateProp.Value = EndOfMatchStateValue;
	Ui.GetContext().Hint.Value = "Hint/EndOfMatch";

	var spawns = Spawns.GetContext();
	spawns.enable = false;
	spawns.Despawn();
	Game.GameOver(LeaderBoard.GetTeams());
	mainTimer.Restart(EndOfMatchTime);
}
function RestartGame() {
	Game.RestartGame();
}

function SpawnTeams() {
	var e = Teams.GetEnumerator();
	while (e.moveNext()) {
		Spawns.GetContext(e.Current).Spawn();
	}
}


