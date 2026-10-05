import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../agency.html', import.meta.url), 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
new vm.Script(script); // Parse the entire production script too.
const reports = script.slice(script.indexOf('let REPORTS ='), script.indexOf('function repDirList()'));
const report = (id, status = 'new', date = '2026-10-05') => ({id, status, report_date:date, code:'CP', headline:'보고 '+id, feedback:null, feedback_at:null, votes:{}, insight:{}, refs:[], ideas:[]});

class Query {
  constructor(db) { this.db=db; this.filters=[]; this.max=Infinity; }
  select() { return this; }
  order(key, opts) { this.ordering={key, ascending:opts.ascending}; return this; }
  limit(n) { this.max=n; return this; }
  eq(key, value) { this.filters.push(r => r[key] === value); return this; }
  lte(key, value) { this.filters.push(r => r[key] <= value); return this; }
  update(patch) { this.patch=patch; return this; }
  maybeSingle() { this.single=true; return this.run(); }
  then(resolve,reject) { return this.run().then(resolve,reject); }
  async run() {
    const stage = this.patch ? 'update' : this.single ? 'boundary' : 'refresh';
    this.db.calls.push(stage);
    if (this.db.fail === stage) throw new Error('network unavailable');
    if (this.patch) this.db.beforeUpdate?.();
    let data=this.db.rows.filter(r => this.filters.every(f => f(r)));
    if (this.patch) {
      assert.deepEqual(Object.keys(this.patch), ['status']);
      assert.equal(this.patch.status,'read');
      data.forEach(r => Object.assign(r,this.patch));
    }
    if (this.ordering) {
      const {key,ascending}=this.ordering;
      data.sort((a,b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (ascending ? 1 : -1));
    }
    const count=data.length;
    data=data.slice(0,this.max).map(r => structuredClone(r));
    return {data:this.single ? data[0] || null : data, error:null, count};
  }
}

function setup(rows, visible=rows) {
  const nodes=new Map();
  const node = key => { if (!nodes.has(key)) nodes.set(key,{innerHTML:'',textContent:'',querySelectorAll:()=>[]}); return nodes.get(key); };
  const db={rows:structuredClone(rows), calls:[], from(name) { assert.equal(name,'agency_reports','Reading a report must not send chat'); return new Query(this); }};
  const context=vm.createContext({sb:db, $:node, AG:{CP:{name:'Owen',role:'카피',sort:1}}, ALUM:{}, TEAM_COLOR:{}, lbl:s=>s, esc:s=>String(s??''), kstNow:()=>({date:'2026-10-05'}), fmtDate:s=>s, toast:s=>node('toast').textContent=s});
  vm.runInContext(reports,context);
  context.fixture=structuredClone(visible);
  vm.runInContext('REPORTS=fixture; REP_DATE="2026-10-05"; renderReports();',context);
  return {db,node,context,run:source=>vm.runInContext(source,context)};
}

test('read reports leave the pending group while feedback stays optional', () => {
  const s=setup([report(1),report(2,'read'),report(3,'replied')]);
  const grid=s.node('#repGrid').innerHTML;
  assert.match(grid,/아직 안 읽은 보고 <b>1<\/b>/);
  assert.match(grid,/읽은 보고 · 피드백 완료 <b>2<\/b>/);
  assert.doesNotMatch(grid,/피드백 기다리는/);
  assert.match(grid,/data-report-feedback="2"/);
});

test('bulk read includes old dates beyond the loaded 300 reports', async () => {
  const rows=Array.from({length:305},(_,i)=>report(i+1,'new',i<5?'2026-09-01':'2026-10-05'));
  const s=setup(rows,rows.slice(5));
  await s.run('markAllRepRead()');
  assert.ok(s.db.rows.every(r=>r.status==='read'));
  assert.match(s.node('#repReadResult').textContent,/305개 보고/);
  assert.equal(s.run('REP_READ_SAVING'),false);
});

test('bulk read preserves concurrent feedback and reports posted after its snapshot', async () => {
  const replied={...report(2,'replied'),feedback:'A안으로',feedback_at:'2026-10-04T00:00:00Z',votes:{ideaA:1}};
  const s=setup([report(1),replied,report(3)]);
  s.db.beforeUpdate=()=>{
    Object.assign(s.db.rows.find(r=>r.id===3),{status:'replied',feedback:'보류',feedback_at:'2026-10-05T01:00:00Z'});
    s.db.rows.push(report(4));
  };
  await s.run('markAllRepRead()');
  assert.equal(s.db.rows[0].status,'read');
  assert.equal(s.db.rows[0].feedback,null);
  assert.deepEqual(s.db.rows[1],replied);
  assert.equal(s.db.rows[2].feedback,'보류');
  assert.equal(s.db.rows[2].status,'replied');
  assert.equal(s.db.rows[3].status,'new');
  assert.match(s.node('#repReadResult').textContent,/1개 보고/);
});

test('single read also preserves feedback submitted during the request', async () => {
  const s=setup([report(1)]);
  s.db.beforeUpdate=()=>Object.assign(s.db.rows[0],{status:'replied',feedback:'수정해줘'});
  await s.run('markRepRead(1)');
  assert.equal(s.db.rows[0].status,'replied');
  assert.equal(s.db.rows[0].feedback,'수정해줘');
});

test('failed writes leave reports intact and re-enable bulk read', async () => {
  const s=setup([report(1)]); s.db.fail='update';
  await s.run('markAllRepRead()');
  assert.equal(s.db.rows[0].status,'new');
  assert.match(s.node('#repReadResult').textContent,/처리하지 못했어요/);
  assert.equal(s.node('#repReadAll').disabled,false);
});

test('a failed reload after saving does not report that the write failed', async () => {
  const s=setup([report(1)]); s.db.fail='refresh';
  await s.run('markAllRepRead()');
  assert.equal(s.db.rows[0].status,'read');
  assert.match(s.node('#repReadResult').textContent,/저장됐어요/);
  assert.doesNotMatch(s.node('#repReadResult').textContent,/처리하지 못/);
});

test('rapid repeated bulk clicks produce one update', async () => {
  const s=setup([report(1)]);
  await Promise.all([s.run('markAllRepRead()'),s.run('markAllRepRead()')]);
  assert.equal(s.db.calls.filter(c=>c==='update').length,1);
});
