<?php
require __DIR__.'/../app/bootstrap.php';
if($_SERVER['REQUEST_METHOD']!=='GET')json_response(['error'=>'Read only.'],405);
try{
    $id=positive($_GET['id']??0);$m=row('SELECT m.*,c.published FROM cup_matches m JOIN cup_competitions c ON c.id=m.competition_id WHERE m.id=?',[$id]);
    if(!$m||!$m['published'])json_response(['error'=>'Match not found.'],404);
    $events=rows('SELECT e.id,e.minute,e.kind,p.name AS player,r.number,t.name AS team FROM cup_events e JOIN cup_entries en ON en.id=e.entry_id JOIN cup_teams t ON t.id=en.team_id LEFT JOIN cup_rosters r ON r.id=e.roster_id LEFT JOIN cup_players p ON p.id=r.player_id WHERE e.match_id=? AND e.voided=0 ORDER BY e.minute,e.id',[$id]);
    json_response(['events'=>$events]);
}catch(DomainException $e){json_response(['error'=>'Invalid match.'],422);}catch(Throwable $e){json_response(['error'=>'Results temporarily unavailable.'],503);}
