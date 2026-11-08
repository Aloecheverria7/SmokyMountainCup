<?php
require_once __DIR__.'/bootstrap.php';
function public_status(array $m): string {
    if($m['away']==='BYE')return 'Bye · advances';
    $s=['scheduled'=>'Scheduled','live'=>'LIVE','half_time'=>'Half-time','paused'=>'Paused','finished'=>'Final','suspended'=>'Suspended'][$m['status']]??$m['status'];
    if(in_array($m['status'],['live','half_time','paused'],true))$s.=' · '.intdiv((int)$m['elapsed'],60).'′';
    return $s;
}
function match_card(array $m): void {
    ?><article class="cup-match-card" data-game-id="<?=h($m['id'])?>"><a href="match.php?id=<?=h($m['id'])?>"><small><?=h($m['category'])?><?=!empty($m['group_name'])?' · '.h($m['group_name']):''?></small><p class="cup-badge <?=$m['status']==='live'?'is-live':''?>" data-game-status><?=h(public_status($m))?></p><div class="cup-team-row"><?php if($m['home_crest']):?><img src="<?=h($m['home_crest'])?>" alt="" loading="lazy" decoding="async"><?php endif;?><?=h($m['home'])?><b data-home-score><?=h($m['home_score'])?></b></div><div class="cup-team-row"><?php if($m['away_crest']):?><img src="<?=h($m['away_crest'])?>" alt="" loading="lazy" decoding="async"><?php endif;?><?=h($m['away'])?><b data-away-score><?=h($m['away_score'])?></b></div><div class="cup-card-footer"><span><?=h($m['field']??'Field TBA')?></span><span><?php if($m['scheduled_at']):?><?=h((new DateTimeImmutable($m['scheduled_at'],new DateTimeZone('UTC')))->setTimezone(new DateTimeZone($m['timezone']))->format('M j · g:i a'))?><?php else:?>Time TBA<?php endif;?></span></div></a></article><?php
}
function safe_public_data(callable $fn,mixed $fallback=[]): mixed { try{return $fn();}catch(Throwable $e){error_log('Cup public data unavailable: '.get_class($e));return $fallback;} }
