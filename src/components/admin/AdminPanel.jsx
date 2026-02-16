import React from 'react';
import TeamLoader from './TeamLoader';
import GenerationParams from './GenerationParams';
import PitchLayoutViz from './PitchLayoutViz';
import FixtureHistory from './FixtureHistory';
import FixturesTable from './FixturesTable';

export default function AdminPanel(props) {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">U7's Waterfall</h1>
              <p className="text-gray-600 mt-1">Generate and manage fixtures</p>
            </div>
          </div>
          {props.error && (
            <div className={`mb-4 p-4 ${props.error.includes('Successfully') ? 'bg-[#7c1229]/5 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'} border rounded-lg`}>
              {props.error}
            </div>
          )}
          <TeamLoader
            sheetUrl={props.sheetUrl}
            setSheetUrl={props.setSheetUrl}
            uploadMethod={props.uploadMethod}
            setUploadMethod={props.setUploadMethod}
            loadingSheet={props.loadingSheet}
            loadTeamsFromSheet={props.loadTeamsFromSheet}
            handleFileUpload={props.handleFileUpload}
            teams={props.teams}
          />
          <GenerationParams
            numRounds={props.numRounds}
            setNumRounds={props.setNumRounds}
            numPitches={props.numPitches}
            setNumPitches={props.setNumPitches}
            matchDuration={props.matchDuration}
            setMatchDuration={props.setMatchDuration}
            startTime={props.startTime}
            setStartTime={props.setStartTime}
            lunchEnabled={props.lunchEnabled}
            setLunchEnabled={props.setLunchEnabled}
            lunchStart={props.lunchStart}
            setLunchStart={props.setLunchStart}
            lunchEnd={props.lunchEnd}
            setLunchEnd={props.setLunchEnd}
            loading={props.loading}
            generateFixtures={props.generateFixtures}
          />
        </div>
        <PitchLayoutViz zones={props.zones} />
        <FixtureHistory
          fixtureHistory={props.fixtureHistory}
          restoreFromHistory={props.restoreFromHistory}
        />
        <FixturesTable
          fixtures={props.fixtures}
          teams={props.teams}
          zones={props.zones}
          loading={props.loading}
          swapMode={props.swapMode}
          setSwapMode={props.setSwapMode}
          swapTeamsInFixture={props.swapTeamsInFixture}
          regenerateRound={props.regenerateRound}
          setError={props.setError}
        />
      </div>
    </div>
  );
}
