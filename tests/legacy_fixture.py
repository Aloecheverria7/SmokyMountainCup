"""Anonymous deterministic SQL data; never copy production dumps into CI."""
from pathlib import Path
def generate(path: Path):
    sets = {
        'categories': (['id','name'], [(i,f'Test category {i}') for i in range(1,5)]),
        'teams': (['id','name'], [(i,f'Test team {i}') for i in range(1,41)]),
        'groups': (['id','name','category_id'], [(i,f'Test group {i}', (i+1)//2 if i<=6 else 4) for i in range(1,11)]),
        'group_teams': (['id','group_id','team_id'], [(i,(i-1)//4+1,i) for i in range(1,41)]),
        'games': (['id','home_team_id','guest_team_id','home_score','guest_score','status','current_minute','field'], [(i,25+(i-1)//6*4,26+(i-1)//6*4,0,0,'not started',0,'Test field') for i in range(1,25)]),
        'team_stats': (['team_id','games_played','wins','draws','losses','goals_scored','goals_conceded','goal_difference','points'], [(i,0,0,0,0,0,0,0,0) for i in range(1,41)]),
    }
    def literal(value):
        return str(value) if isinstance(value,int) else "'"+value.replace("'","\\'")+"'"
    source=[]
    for table,(columns,records) in sets.items():
        source.append('INSERT INTO `'+table+'` ('+','.join('`'+c+'`' for c in columns)+') VALUES '+','.join('('+','.join(literal(v) for v in record)+')' for record in records)+';')
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text('\n'.join(source),encoding='utf-8')
