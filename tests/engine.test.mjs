// Existing Node.js engine tests

import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDatasets, suggestImportOrder } from '../src/lib/rehearsal/engine.ts';

const departments = {
  name:'departments', primaryKey:'id', required:['name'],
  rows:[{id:'10',name:'Software Engineering'}, {id:'20',name:'Computer Science'}]
};
const students = {
  name:'students', primaryKey:'id', required:['name','department_id'],
  foreignKeys:[{column:'department_id',targetDataset:'departments',targetColumn:'id'}],
  rows:[
    {id:'1',name:'Ali',department_id:'10'},
    {id:'2',name:'Sara',department_id:'20'},
    {id:'3',name:'Ahmed',department_id:'99'},
    {id:'3',name:'Bilal',department_id:'10'}
  ]
};

test('detects duplicate primary key and missing foreign key', () => {
  const report = validateDatasets([students,departments]);
  assert.equal(report.totalRows,6);
  assert.equal(report.invalidRows,2);
  assert.equal(report.validRows,4);
  assert.equal(report.issues.filter(x=>x.code==='DUPLICATE_PK').length,2);
  assert.equal(report.issues.filter(x=>x.code==='FK_NOT_FOUND').length,1);
  assert.equal(report.blocked,true);
});

test('valid data is ready for review', () => {
  const clean={...students,rows:students.rows.slice(0,2)};
  const report=validateDatasets([clean,departments]);
  assert.equal(report.invalidRows,0);
  assert.equal(report.blocked,false);
});

test('detects required fields', () => {
  const report = validateDatasets([{name:'example',primaryKey:'id',required:['name'],rows:[{id:'',name:''}]}]);
  assert.equal(report.invalidRows,1);
  assert.equal(report.issues.filter(x=>x.code==='REQUIRED').length,2);
});

test('parent tables come before children', () => {
  assert.deepEqual(suggestImportOrder([students,departments]),{order:['departments','students'],cycles:[]});
});

test('cycles are reported rather than inventing order', () => {
  const a = {name:'A',rows:[],foreignKeys:[{column:'b',targetDataset:'B',targetColumn:'id'}]};
  const b = {name:'B',rows:[],foreignKeys:[{column:'a',targetDataset:'A',targetColumn:'id'}]};
  assert.equal(suggestImportOrder([a,b]).cycles.length,2);
});
