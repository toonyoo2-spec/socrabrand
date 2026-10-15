import test from 'node:test';
import assert from 'node:assert/strict';
import {driveBrowseQuery} from '../../drive-browser.mjs';
const escape=s=>s.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
test('Drive folder picker scopes root, descendants, shared files and name searches',()=>{assert.match(driveBrowseQuery({},escape),/'root' in parents/);assert.match(driveBrowseQuery({parentId:'chosen'},escape),/'chosen' in parents/);assert.match(driveBrowseQuery({shared:true},escape),/sharedWithMe = true/);const q=driveBrowseQuery({query:"teacher's",type:'presentation'},escape);assert.ok(q.includes("name contains 'teacher\\'s'"));assert.ok(q.includes('application/vnd.google-apps.presentation'));assert.ok(!q.includes('in parents'));assert.ok(!driveBrowseQuery({type:'folder'},escape).includes('application/vnd.google-apps.presentation'));});
