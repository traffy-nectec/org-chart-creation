const idMap = new Map();
const nodes = [];
for (let i = 0; i < 35000; i++) {
   nodes.push({ id: `n${i}`, parentId: i > 0 ? `n${Math.floor(i/10)}` : null });
}

console.time('build tree');
const childrenMap = new Map();
nodes.forEach(org => {
  if (org.parentId) {
    if (!childrenMap.has(org.parentId)) {
       childrenMap.set(org.parentId, []);
    }
    childrenMap.get(org.parentId).push(org);
  }
});

const nodeMap = {};
nodes.forEach(org => { nodeMap[org.id] = { ...org, children: [] }; });
const visited = new Set();
const traverse = (node) => {
  if (!node) return;
  const children = childrenMap.get(node.id) || [];
  children.forEach(child => {
    const childNode = nodeMap[child.id];
    if (childNode && !visited.has(childNode.id)) {
      visited.add(childNode.id);
      node.children.push(childNode);
      traverse(childNode);
    }
  });
};
traverse(nodeMap['n0']);
console.timeEnd('build tree');
