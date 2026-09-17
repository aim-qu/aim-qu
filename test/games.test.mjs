import {test} from 'node:test';
import assert from 'node:assert/strict';
import {puzzle,toggle,solve,memoryDeck,judgeRhythm} from '../site/games.mjs';
test('all generated light puzzles in 100 seeds have a playable solution',()=>{for(let seed=0;seed<100;seed++){const board=puzzle(seed);assert(board.some(Boolean));const moves=solve(board);assert(moves);assert(moves.reduce((state,index)=>toggle(state,index),board).every(n=>n===0));}});
test('corner presses affect only the corner and its actual neighbors',()=>{assert.deepEqual(toggle(Array(25).fill(0),0).map((v,i)=>v?i:-1).filter(i=>i>=0),[0,1,5]);});
test('pressing the same light twice restores the board',()=>{const board=puzzle(47);assert.deepEqual(toggle(toggle(board,12),12),board);});
test('memory decks contain six pairs after shuffling',()=>{for(let seed=1;seed<20;seed++){const deck=memoryDeck(seed);assert.equal(deck.length,12);for(let value=0;value<6;value++)assert.equal(deck.filter(n=>n===value).length,2);}});
test('rhythm timing boundaries classify without awarding distant hits',()=>{assert.equal(judgeRhythm(0),'perfect');assert.equal(judgeRhythm(35),'perfect');assert.equal(judgeRhythm(36),'good');assert.equal(judgeRhythm(80),'good');assert.equal(judgeRhythm(81),'miss');});
