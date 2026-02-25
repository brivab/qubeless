/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const file = 'src/modules/project-members/project-members.controller.spec.ts';
let content = fs.readFileSync(file, 'utf8');

// Fix updateMember call
content = content.replace(
  'const result = await controller.updateMember(projectKey, memberId, dto);',
  'const result = await controller.updateMember(projectKey, memberId, dto, undefined);',
);

// Fix updateMember assertion
content = content.replace(
  'expect(service.updateMember).toHaveBeenCalledWith(projectKey, memberId, dto);',
  'expect(service.updateMember).toHaveBeenCalledWith(projectKey, memberId, dto, undefined);',
);

// Fix removeMember call
content = content.replace(
  'await controller.removeMember(projectKey, memberId);',
  'await controller.removeMember(projectKey, memberId, undefined);',
);

// Fix removeMember assertion
content = content.replace(
  'expect(service.removeMember).toHaveBeenCalledWith(projectKey, memberId);',
  'expect(service.removeMember).toHaveBeenCalledWith(projectKey, memberId, undefined);',
);

fs.writeFileSync(file, content);
console.log('Fixed!');
