<?php
declare(strict_types=1);

/** Stable display order; equal sporting criteria still require organizer confirmation. */
function compare_standing(array $a,array $b): int {
    return ($a['group_id']<=>$b['group_id'])?:($b['points']<=>$a['points'])?:($b['gd']<=>$a['gd'])?:($b['gf']<=>$a['gf'])?:strcmp($a['name'],$b['name']);
}
/** Every entry appears once; no empty-versus-empty fixtures. */
function knockout_pairs(array $ids): array {
    if(count($ids)<2 || count($ids)>512 || count(array_unique($ids))!==count($ids)) throw new InvalidArgumentException('Invalid knockout entries.');
    $size=2;while($size<count($ids))$size*=2;
    $byes=$size-count($ids);$pairs=[];$offset=0;
    for($p=0;$p<$size/2;$p++)$pairs[]=[$ids[$offset++],$p<$byes?null:$ids[$offset++]];
    return $pairs;
}
function clock_seconds(array $match,int $timestamp): int {
    return (int)$match['elapsed_seconds']+($match['status']==='live' && $match['clock_started_at']?max(0,$timestamp-strtotime($match['clock_started_at'].' UTC')):0);
}
