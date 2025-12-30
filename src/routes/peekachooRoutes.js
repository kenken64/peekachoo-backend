const express = require('express');
const {
    getAllPeekachoos,
    getPeekachooById,
    createPeekachoo,
    updatePeekachoo,
    deletePeekachoo
} = require('../controllers/peekachooController');

const router = express.Router();

router.get('/', getAllPeekachoos);
router.get('/:id', getPeekachooById);
router.post('/', createPeekachoo);
router.put('/:id', updatePeekachoo);
router.delete('/:id', deletePeekachoo);

module.exports = router;
