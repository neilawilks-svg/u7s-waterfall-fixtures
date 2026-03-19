import React, { useRef, useState } from 'react';
import { Download, RefreshCw } from '../icons';
import { downloadImportTemplate } from '../../utils/fixtureImporter';

export default function FixtureImporter({ importFixtures, loading }) {
  const inputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0] || null);
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    await importFixtures(selectedFile);
    setSelectedFile(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Import Fixture Schedule</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Upload an Excel (.xlsx) file to replace the current fixtures. Each row is one fixture with columns:
            Round, Time, Pitch, Zone, Team 1, Team 2, Club 1, Club 2, Cross-Zone, Referee, Referee Club, Ref Conflict.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <button
          onClick={downloadImportTemplate}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium border border-gray-300"
        >
          <Download size={16} />
          Download Template
        </button>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 text-sm font-medium border border-gray-300">
          <Download size={16} className="rotate-180" />
          {selectedFile ? selectedFile.name : 'Choose file…'}
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>
        <button
          onClick={handleImport}
          disabled={!selectedFile || loading}
          className="flex items-center gap-2 px-4 py-2 bg-[#7c1229] text-white rounded-lg hover:bg-[#a01638] disabled:bg-gray-400 text-sm font-medium"
        >
          {loading ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              Importing…
            </>
          ) : (
            'Import Fixtures'
          )}
        </button>
        {selectedFile && !loading && (
          <button
            onClick={() => { setSelectedFile(null); if (inputRef.current) inputRef.current.value = ''; }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
