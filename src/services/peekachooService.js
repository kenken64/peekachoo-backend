const Peekachoo = require('../models/Peekachoo');

// In-memory storage for when database is not connected
let inMemoryData = [
    { id: 1, name: 'Peekachoo', description: 'A fun backend service' }
];

exports.getAllPeekachoos = async () => {
    try {
        if (require('mongoose').connection.readyState === 1) {
            return await Peekachoo.find();
        }
        return inMemoryData;
    } catch (error) {
        return inMemoryData;
    }
};

exports.getPeekachooById = async (id) => {
    try {
        if (require('mongoose').connection.readyState === 1) {
            return await Peekachoo.findById(id);
        }
        return inMemoryData.find(item => item.id === parseInt(id));
    } catch (error) {
        return inMemoryData.find(item => item.id === parseInt(id));
    }
};

exports.createPeekachoo = async (data) => {
    try {
        if (require('mongoose').connection.readyState === 1) {
            const newPeekachoo = new Peekachoo(data);
            return await newPeekachoo.save();
        }
        const newItem = { id: inMemoryData.length + 1, ...data };
        inMemoryData.push(newItem);
        return newItem;
    } catch (error) {
        const newItem = { id: inMemoryData.length + 1, ...data };
        inMemoryData.push(newItem);
        return newItem;
    }
};

exports.updatePeekachoo = async (id, data) => {
    try {
        if (require('mongoose').connection.readyState === 1) {
            return await Peekachoo.findByIdAndUpdate(id, data, { new: true });
        }
        const index = inMemoryData.findIndex(item => item.id === parseInt(id));
        if (index !== -1) {
            inMemoryData[index] = { ...inMemoryData[index], ...data };
            return inMemoryData[index];
        }
        return null;
    } catch (error) {
        return null;
    }
};

exports.deletePeekachoo = async (id) => {
    try {
        if (require('mongoose').connection.readyState === 1) {
            return await Peekachoo.findByIdAndDelete(id);
        }
        const index = inMemoryData.findIndex(item => item.id === parseInt(id));
        if (index !== -1) {
            const deleted = inMemoryData.splice(index, 1);
            return deleted[0];
        }
        return null;
    } catch (error) {
        return null;
    }
};
