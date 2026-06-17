const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const historyFile = path.join(__dirname, '../history/history.json');
const historyDir = path.join(__dirname, '../history');

fs.ensureDirSync(historyDir);
if (!fs.existsSync(historyFile)) {
  fs.writeJSONSync(historyFile, []);
}

const addHistory = (record) => {
  const history = fs.readJSONSync(historyFile);
  const newRecord = {
    id: uuidv4(),
    ...record,
    createdAt: new Date().toISOString()
  };
  history.unshift(newRecord);
  fs.writeJSONSync(historyFile, history);
  return newRecord;
};

const getHistory = () => {
  return fs.readJSONSync(historyFile);
};

const deleteHistory = (id) => {
  const history = fs.readJSONSync(historyFile);
  const record = history.find(r => r.id === id);
  if (record && record.filePath) {
    const filePath = path.join(__dirname, '../..', record.filePath);
    if (fs.existsSync(filePath)) {
      fs.removeSync(filePath);
    }
  }
  const newHistory = history.filter(r => r.id !== id);
  fs.writeJSONSync(historyFile, newHistory);
  return true;
};

const clearHistory = () => {
  const history = fs.readJSONSync(historyFile);
  history.forEach(record => {
    if (record.filePath) {
      const filePath = path.join(__dirname, '../..', record.filePath);
      if (fs.existsSync(filePath)) {
        fs.removeSync(filePath);
      }
    }
  });
  fs.writeJSONSync(historyFile, []);
  return true;
};

const deleteBatchHistory = (ids) => {
  const history = fs.readJSONSync(historyFile);
  ids.forEach(id => {
    const record = history.find(r => r.id === id);
    if (record && record.filePath) {
      const filePath = path.join(__dirname, '../..', record.filePath);
      if (fs.existsSync(filePath)) {
        fs.removeSync(filePath);
      }
    }
  });
  const newHistory = history.filter(r => !ids.includes(r.id));
  fs.writeJSONSync(historyFile, newHistory);
  return true;
};

module.exports = {
  addHistory,
  getHistory,
  deleteHistory,
  clearHistory,
  deleteBatchHistory
};
