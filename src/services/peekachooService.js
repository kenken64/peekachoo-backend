// In-memory storage for demo/test data
let inMemoryData = [
    { id: 1, name: 'Peekachoo', description: 'A fun backend service' }
];

exports.getAllPeekachoos = async () => {
    return inMemoryData;
};

exports.getPeekachooById = async (id) => {
    return inMemoryData.find(item => item.id === parseInt(id));
};

exports.createPeekachoo = async (data) => {
    const newItem = { id: inMemoryData.length + 1, ...data };
    inMemoryData.push(newItem);
    return newItem;
};

exports.updatePeekachoo = async (id, data) => {
    const index = inMemoryData.findIndex(item => item.id === parseInt(id));
    if (index !== -1) {
        inMemoryData[index] = { ...inMemoryData[index], ...data };
        return inMemoryData[index];
    }
    return null;
};

exports.deletePeekachoo = async (id) => {
    const index = inMemoryData.findIndex(item => item.id === parseInt(id));
    if (index !== -1) {
        const deleted = inMemoryData.splice(index, 1);
        return deleted[0];
    }
    return null;
};
