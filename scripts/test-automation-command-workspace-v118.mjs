import fs from 'node:fs';import assert from 'node:assert/strict';
const js=fs.readFileSync('public/automation-command-workspace.js','utf8'),css=fs.readFileSync('public/assets/css/system/52-automation-command.css','utf8');
for(const token of ['Automation Builder','Test Workflow','Trigger','Condition','Get Data','Branch','Wait','Approval','Open Azzy','PoolShedAzzyJarvis'])assert(js.includes(token),`missing automation/Azzy control ${token}`);
for(const token of ['.automation-command','.az-panel','.flow-canvas','.flow-node'])assert(css.includes(token),`missing CSS selector ${token}`);
for(const retired of ['PoolShedAssistantEngine','azzyFloating','assistantMode','Find Anything','Guide Me','Training'])assert.equal(js.includes(retired),false,`retired assistant path remains: ${retired}`);
new Function(js);console.log('PASS Automation Command workspace with single Azzy Jarvis entry point');
