import React from 'react';
import { Download } from '../icons';

export default function TeamLoader({ sheetUrl, setSheetUrl, uploadMethod, setUploadMethod, loadingSheet, loadTeamsFromSheet, handleFileUpload, teams }) {
  return (
    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <h3 className="font-semibold text-blue-900 mb-3">Load Teams from Google Sheet</h3>
      <div className="mb-3 flex gap-2">
        <button onClick={() => setUploadMethod('url')} className={`px-4 py-2 rounded-lg ${uploadMethod === 'url' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-blue-300'}`}>From URL</button>
        <button onClick={() => setUploadMethod('file')} className={`px-4 py-2 rounded-lg ${uploadMethod === 'file' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-blue-300'}`}>Upload File</button>
      </div>
      {uploadMethod === 'url' ? (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Google Sheet URL</label>
            <div className="flex gap-2">
              <input type="text" value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." className="flex-1 px-3 py-2 border border-gray-300 rounded-lg" />
              {sheetUrl && (
                <button onClick={() => setSheetUrl('')} className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium whitespace-nowrap">
                  Clear
                </button>
              )}
            </div>
            <p className="text-xs text-gray-600 mt-1">Make sure your sheet is published to web</p>
          </div>
          <button onClick={loadTeamsFromSheet} disabled={loadingSheet || !sheetUrl} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
            <Download size={18} className={loadingSheet ? 'animate-spin' : ''} />
            {loadingSheet ? 'Loading...' : 'Load Teams from Sheet'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Upload Excel or CSV File</label>
            <p className="text-xs text-gray-600 mb-2">Download your sheet as Excel (.xlsx) or CSV</p>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white" />
          </div>
        </div>
      )}
      {teams.length > 0 && <p className="text-sm text-green-700 font-medium mt-3">{'\u2713'} {teams.length} teams loaded and ready</p>}
    </div>
  );
}
