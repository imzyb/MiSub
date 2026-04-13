
// Test logic for pruneInvalidReferences
function testPruning() {
    const subscriptions = [
        { id: 'sub1', name: 'Sub 1' },
        { id: 'sub2', name: 'Sub 2' },
        { id: 'node1', name: 'Node 1' },
        { id: 'node2', name: 'Node 2' }
    ];

    const profiles = [
        {
            name: 'Profile 1',
            subscriptions: ['sub1', 'ghost_sub', 'sub1'], // ghost and duplicate
            manualNodes: ['node1', 'ghost_node', 'node2', 'node1'] // ghost and duplicate
        }
    ];

    const validIds = new Set(subscriptions.map(item => item.id));
    
    let modified = false;
    const resultProfiles = JSON.parse(JSON.stringify(profiles));
    
    resultProfiles.forEach(profile => {
        // 1. Manual Node Pruning
        if (Array.isArray(profile.manualNodes)) {
            const originalLength = profile.manualNodes.length;
            const seenIds = new Set();
            profile.manualNodes = profile.manualNodes.filter(id => {
                if (validIds.has(id) && !seenIds.has(id)) {
                    seenIds.add(id);
                    return true;
                }
                return false;
            });
            if (profile.manualNodes.length !== originalLength) {
                modified = true;
            }
        }

        // 2. Subscription Pruning
        if (Array.isArray(profile.subscriptions)) {
            const originalLength = profile.subscriptions.length;
            const seenIds = new Set();
            profile.subscriptions = profile.subscriptions.filter(id => {
                if (validIds.has(id) && !seenIds.has(id)) {
                    seenIds.add(id);
                    return true;
                }
                return false;
            });
            if (profile.subscriptions.length !== originalLength) {
                modified = true;
            }
        }
    });

    console.log('Modified:', modified);
    console.log('Result Subscriptions:', resultProfiles[0].subscriptions);
    console.log('Result Manual Nodes:', resultProfiles[0].manualNodes);

    const expectedSubs = ['sub1'];
    const expectedNodes = ['node1', 'node2'];

    const subsMatch = JSON.stringify(resultProfiles[0].subscriptions) === JSON.stringify(expectedSubs);
    const nodesMatch = JSON.stringify(resultProfiles[0].manualNodes) === JSON.stringify(expectedNodes);

    if (modified && subsMatch && nodesMatch) {
        console.log('SUCCESS: Pruning logic works correctly!');
    } else {
        console.error('FAILURE: Pruning logic failed!');
        process.exit(1);
    }
}

testPruning();
