const express = require('express');
const router = express.Router();
const { getHistory, deleteHistory, clearHistory, deleteBatchHistory } = require('../utils/history');

router.get('/', (req, res) => {
  try {
    const history = getHistory();
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    deleteHistory(id);
    res.json({
      success: true,
      message: 'History item deleted'
    });
  } catch (error) {
    console.error('Delete history error:', error);
    res.status(500).json({ error: 'Failed to delete history item' });
  }
});

router.delete('/batch', (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Please provide ids to delete' });
    }
    deleteBatchHistory(ids);
    res.json({
      success: true,
      message: `${ids.length} history items deleted`
    });
  } catch (error) {
    console.error('Batch delete history error:', error);
    res.status(500).json({ error: 'Failed to batch delete history items' });
  }
});

router.delete('/', (req, res) => {
  try {
    clearHistory();
    res.json({
      success: true,
      message: 'All history cleared'
    });
  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({ error: 'Failed to clear history' });
  }
});

module.exports = router;
