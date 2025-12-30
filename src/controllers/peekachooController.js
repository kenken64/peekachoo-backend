const peekachooService = require('../services/peekachooService');

exports.getAllPeekachoos = async (req, res, next) => {
    try {
        const peekachoos = await peekachooService.getAllPeekachoos();
        res.json({
            success: true,
            data: peekachoos
        });
    } catch (error) {
        next(error);
    }
};

exports.getPeekachooById = async (req, res, next) => {
    try {
        const peekachoo = await peekachooService.getPeekachooById(req.params.id);
        if (!peekachoo) {
            return res.status(404).json({
                success: false,
                message: 'Peekachoo not found'
            });
        }
        res.json({
            success: true,
            data: peekachoo
        });
    } catch (error) {
        next(error);
    }
};

exports.createPeekachoo = async (req, res, next) => {
    try {
        const peekachoo = await peekachooService.createPeekachoo(req.body);
        res.status(201).json({
            success: true,
            data: peekachoo
        });
    } catch (error) {
        next(error);
    }
};

exports.updatePeekachoo = async (req, res, next) => {
    try {
        const peekachoo = await peekachooService.updatePeekachoo(req.params.id, req.body);
        if (!peekachoo) {
            return res.status(404).json({
                success: false,
                message: 'Peekachoo not found'
            });
        }
        res.json({
            success: true,
            data: peekachoo
        });
    } catch (error) {
        next(error);
    }
};

exports.deletePeekachoo = async (req, res, next) => {
    try {
        const peekachoo = await peekachooService.deletePeekachoo(req.params.id);
        if (!peekachoo) {
            return res.status(404).json({
                success: false,
                message: 'Peekachoo not found'
            });
        }
        res.json({
            success: true,
            message: 'Peekachoo deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};
