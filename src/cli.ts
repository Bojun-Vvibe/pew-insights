#!/usr/bin/env node
import chalk from 'chalk';
import { Command } from 'commander';
import { promises as fs } from 'node:fs';
import { resolvePewPaths } from './paths.js';
import {
  countRuns,
  fileSize,
  readCursors,
  readQueue,
  readSessionQueue,
  readSessionQueueRaw,
  readState,
} from './parsers.js';
import {
  buildDigest,
  buildDoctor,
  buildSourcesPivot,
  buildStatus,
  resolveSince,
} from './report.js';
import {
  renderBudget,
  renderCompare,
  renderCost,
  renderDigest,
  renderDoctor,
  renderForecast,
  renderSources,
  renderStatus,
  renderTopProjects,
  renderTrend,
  renderAnomalies,
  renderRatios,
  renderDashboard,
  renderHeatmap,
  renderStreaks,
  renderSessions,
  renderGaps,
  renderVelocity,
  renderConcurrency,
  renderTransitions,
  renderAgentMix,
  renderSessionLengths,
  type SessionLengthsUnit,
  renderReplyRatio,
  renderTurnCadence,
  renderMessageVolume,
  renderModelSwitching,
  renderIdleGaps,
  renderSourceMix,
  renderProviderShare,
  renderTimeOfDay,
  renderCacheHitRatio,
  renderReasoningShare,
  renderPromptSize,
  renderOutputSize,
  renderPeakHourShare,
  renderWeekdayShare,
  renderBurstiness,
  renderDeviceShare,
  renderOutputInputRatio,
  renderModelMixEntropy,
  renderWeekendVsWeekday,
  renderCacheHitByHour,
  renderModelCohabitation,
  renderInterarrivalTime,
  renderBucketIntensity,
  renderTokenVelocityPercentiles,
  renderCostPerBucketPercentiles,
  renderRollingBucketCv,
  renderDailyTokenAutocorrelationLag1,
  renderDailyTokenMonotoneRunLength,
  renderDailyTokenZscoreExtremes,
  renderDailyTokenSecondDiffSignRuns,
  renderSourceOutputTokenBenfordDeviation,
  renderSourceTokenMassHourCentroid,
  renderSourceDayOfWeekTokenMassShare,
  renderSourceDeadHourCount,
  renderSourceActiveHourLongestRun,
  renderSourceActiveHourSpan,
  renderSourceWeekendWeekdayCacheShareGap,
  renderSourceDailyTokenTrendSlope,
  renderSourceBurstinessFanoFactor,
  renderSourceCostClassMix,
  renderSourceHourOfDayTokenMassEntropy,
  renderDailyTokenGini,
  renderSourceHourTopKMassShare,
  renderCumulativeTokensMidpoint,
  renderSourceIoRatioStability,
  renderSourceOutputTokensPerRowPercentiles,
  renderSourceSingleDayMassConcentration,
  renderSourceCumulativeMassHalfLifeDay,
  renderSourceColdWarmRowRatio,
  renderSourceReasoningShareByDayCv,
  renderSourceCacheShareByDayCv,
  renderSourceOutputTokensByHourCv,
  renderSourceInputTokenTopRowShare,
  renderSourceZeroOutputRowShare,
  renderSourceGapHoursCv,
  renderSourceInputOutputCorrelationCoefficient,
  renderSourceFirstVsLastQuartileOutputMeanShift,
  renderSourceRowTokenSkewness,
  renderSourceRowTokenKurtosis,
  renderSourceRowTokenCoefficientOfVariation,
  renderSourceRowTokenMad,
  renderSourceRowTokenGini,
  renderSourceSameModelStreak,
  renderSourceRowTokenAutocorrelationLag1,
  renderSourceRowTokenIqrRatio,
  renderSourceRowTokenBowleySkewness,
  renderSourceRowTokenCoefficientOfQuartileDeviation,
  renderSourceRowTokenTrimean,
  renderSourceRowTokenMidhinge,
  renderSourceRowTokenMidRange,
  renderSourceRowTokenTrimMean25,
  renderSourceRowTokenHarmonicMean,
  renderSourceRowTokenQuadraticMean,
  renderSourceRowTokenContraharmonicMean,
  renderSourceRowTokenLehmer3Mean,
  renderSourceRowTokenLehmer4Mean,
  renderSourceRowTokenLehmer5Mean,
  renderSourceRowTokenLehmer6Mean,
  renderSourceRowTokenLehmer7Mean,
  renderSourceRowTokenLehmer8Mean,
  renderSourceRowTokenLehmer9Mean,
  renderSourceRowTokenLehmer10Mean,
  renderSourceRowTokenLehmer11Mean,
  renderSourceRowTokenLehmer12Mean,
  renderSourceRowTokenWinsorizedMean10,
  renderSourceRowTokenWinsorizedMean20,
  renderSourceRowTokenTrimMean10,
  renderSourceRowTokenTrimMean20,
  renderSourceRowTokenTrimMean30,
  renderSourceRowTokenHodgesLehmann,
  renderSourceRowTokenBroadenedMedian,
  renderSourceRowTokenMEstimatorHuber,
  renderSourceRowTokenMEstimatorTukey,
  renderSourceRowTokenMEstimatorHampel,
  renderSourceRowTokenMEstimatorAndrews,
  renderSourceRowTokenMEstimatorWelsch,
  renderSourceRowTokenMEstimatorCauchy,
  renderSourceRowTokenMEstimatorGemanMcClure,
  renderSourceRowTokenTheilSenSlope,
  renderSourceRowTokenSiegelSlope,
  renderSourceRowTokenPassingBablokSlope,
  renderSourceRowTokenDemingSlope,
  renderSourceRowTokenBootstrapSlopeCi,
  renderSourceRowTokenJackknifeSlopeCi,
  renderSourceRowTokenLehmerNegOneMean,
  renderSourceRowTokenLehmerNegTwoMean,
  renderSourceRowTokenLehmerNegThreeMean,
  renderSourceRowTokenBurstinessCoefficient,
  renderSourceRowTokenRunsTest,
  renderSourceRowTokenTurningPointCount,
  renderSourceRowTokenPermutationEntropy,
  renderSourceRowTokenSampleEntropy,
  renderSourceRowTokenHiguchiFd,
  renderSourceRowTokenKatzFd,
  renderSourceRowTokenHjorthMobility,
  renderSourceRowTokenHjorthComplexity,
  renderSourceRowTokenZeroCrossingRate,
  renderSourceRowTokenApproximateEntropy,
  renderSourceRowTokenTeagerKaiser,
  renderSourceRowTokenCrestFactor,
  renderSourceRowTokenSpectralFlatness,
  renderSourceRowTokenSpectralRolloff,
  renderSourceRowTokenSpectralCentroid,
  renderSourceRowTokenSpectralBandwidth,
  renderSourceRowTokenSpectralSkewness,
  renderSourceRowTokenSpectralKurtosis,
  renderSourceRowTokenSpectralEntropy,
  renderSourceRowTokenSpectralDecrease,
  renderSourceRowTokenSpectralIrregularity,
  renderSourceRowTokenTemporalCentroid,
  renderSourceRowTokenTemporalSpread,
  renderSourceRowTokenTemporalSkewness,
  renderSourceRowTokenTemporalKurtosis,
  renderSourceRowTokenTemporalFlatness,
  renderSourceRowTokenTemporalEntropy,
  renderSourceRowTokenPetrosianFd,
  renderSourceRowTokenLempelZiv,
  renderSourceRowTokenRenyiEntropy,
  renderSourceRowTokenDfa,
  renderSourceRowTokenMannKendallTrend,
  renderSourceRowTokenHurstRs,
  renderSourcePeakHourOfDayArgmax,
  renderModelTenure,
  renderProviderTenure,
  renderTailShare,
  renderTenureDensityQuadrant,
  renderSourceTenure,
  renderBucketStreakLength,
  renderBucketGapDistribution,
  renderSourceDecayHalfLife,
  renderBucketHandoffFrequency,
  renderInterSourceHandoffLatency,
  renderSourcePairCooccurrence,
  renderProviderSwitchingFrequency,
  renderFirstBucketOfDay,
  renderLastBucketOfDay,
  renderActiveSpanPerDay,
  renderSourceBreadthPerDay,
  renderBucketDensityPercentile,
  renderHourOfWeek,
  renderDeviceTenure,
  renderPromptOutputCorrelation,
  renderOutputTokenDecileDistribution,
  renderInputTokenDecileDistribution,
  renderSourceRunLengths,
  renderHourOfDaySourceMixEntropy,
  renderBucketTokenGini,
  renderHourOfDayTokenSkew,
  renderSourceRankChurn,
  renderSourceDebutRecency,
  renderSourceActiveDayStreak,
  renderSourceDrySpell,
} from './format.js';
import { renderHtmlReport } from './html.js';
import {
  computeCost,
  DEFAULT_RATES,
  defaultRatesPath,
  mergeRates,
  readRatesFile,
} from './cost.js';
import {
  buildLookup,
  defaultCachePath,
  isPathDenylisted,
  readCache,
  redactPath,
  scanCandidates,
  writeCache,
  type ResolvedRef,
} from './projects.js';
import { executeCompaction, planCompaction } from './compact.js';
import { attributeTokensByProject } from './byproject.js';
import { executeGc, planGc } from './gcruns.js';
import { buildTrend } from './trend.js';
import { buildTopProjects } from './topprojects.js';
import { buildForecast } from './forecast.js';
import { buildBudget, defaultBudgetPath, readBudgetFile } from './budget.js';
import { buildCompare, resolveComparePreset, type CompareDimension, type CompareWindow } from './compare.js';
import { exportQueue, exportSessions, type ExportFormat } from './export.js';
import { buildAnomalies } from './anomalies.js';
import { buildRatiosReport } from './ratiosreport.js';
import { buildDashboard } from './dashboard.js';
import { buildHeatmap, type HeatmapMetric, type HeatmapTz } from './heatmap.js';
import { buildStreaks } from './streaks.js';
import { buildSessions, type SessionsDimension } from './sessions.js';
import { buildGaps } from './gaps.js';
import { buildVelocity } from './velocity.js';
import { buildConcurrency } from './concurrency.js';
import { buildTransitions, type TransitionsDimension } from './transitions.js';
import { buildAgentMix, type AgentMixDimension, type AgentMixMetric } from './agentmix.js';
import {
  buildSessionLengths,
  DEFAULT_LENGTH_EDGES_SECONDS,
  type SessionLengthsDimension,
} from './sessionlengths.js';
import {
  buildReplyRatio,
  DEFAULT_RATIO_EDGES,
  type ReplyRatioDimension,
} from './replyratio.js';
import {
  buildTurnCadence,
  DEFAULT_CADENCE_EDGES_SECONDS,
  type TurnCadenceDimension,
} from './turncadence.js';
import { buildSourceRunLengths } from './sourcerunlengths.js';
import { buildHourOfDaySourceMixEntropy } from './hourofdaysourcemixentropy.js';
import { buildBucketTokenGini } from './buckettokengini.js';
import { buildHourOfDayTokenSkew } from './hourofdaytokenskew.js';
import { buildSourceRankChurn } from './sourcerankchurn.js';
import { buildSourceDebutRecency } from './sourcedebutrecency.js';
import { buildSourceActiveDayStreak } from './sourceactivedaystreak.js';
import { buildSourceDrySpell } from './sourcedryspell.js';
import {
  buildMessageVolume,
  DEFAULT_VOLUME_EDGES,
  type MessageVolumeDimension,
} from './messagevolume.js';
import {
  buildModelSwitching,
  type ModelSwitchingDimension,
} from './modelswitching.js';
import {
  buildIdleGaps,
  DEFAULT_IDLE_GAP_EDGES_SECONDS,
  type IdleGapsDimension,
} from './idlegaps.js';
import {
  buildSourceMix,
  type SourceMixBucketUnit,
} from './sourcemix.js';
import { buildProviderShare } from './providershare.js';
import { buildCacheHitRatio } from './cachehitratio.js';
import { buildReasoningShare } from './reasoningshare.js';
import { buildPromptSize } from './promptsize.js';
import { buildOutputSize } from './outputsize.js';
import { buildPeakHourShare } from './peakhour.js';
import { buildWeekdayShare } from './weekdayshare.js';
import { buildBurstiness } from './burstiness.js';
import { buildDeviceShare } from './deviceshare.js';
import { buildPromptOutputCorrelation } from './promptoutputcorrelation.js';
import { buildWeekendVsWeekday } from './weekendvsweekday.js';
import { buildCacheHitByHour } from './cachehitbyhour.js';
import { buildModelCohabitation } from './modelcohabitation.js';
import { buildInterarrivalTime } from './interarrivaltime.js';
import { buildBucketIntensity } from './bucketintensity.js';
import { buildTokenVelocityPercentiles } from './tokenvelocitypercentiles.js';
import { buildCostPerBucketPercentiles } from './costperbucketpercentiles.js';
import { buildRollingBucketCv } from './rollingbucketcv.js';
import { buildDailyTokenAutocorrelationLag1 } from './dailytokenautocorrelationlag1.js';
import { buildDailyTokenMonotoneRunLength } from './dailytokenmonotonerunlength.js';
import { buildDailyTokenSecondDiffSignRuns } from './dailytokenseconddiffsignruns.js';
import { buildSourceOutputTokenBenfordDeviation } from './sourceoutputtokenbenforddeviation.js';
import { buildSourceTokenMassHourCentroid } from './sourcetokenmasshourcentroid.js';
import { buildSourceDayOfWeekTokenMassShare } from './sourcedayofweektokenmassshare.js';
import { buildSourceDeadHourCount } from './sourcedeadhourcount.js';
import { buildSourceActiveHourLongestRun } from './sourceactivehourlongestrun.js';
import { buildSourceActiveHourSpan } from './sourceactivehourspan.js';
import { buildSourceWeekendWeekdayCacheShareGap } from './sourceweekendweekdaycachesharegap.js';
import { buildSourceDailyTokenTrendSlope } from './sourcedailytokentrendslope.js';
import { buildSourceBurstinessFanoFactor } from './sourceburstinessfanofactor.js';
import { buildSourceCostClassMix } from './sourcecostclassmix.js';
import { buildSourceHourOfDayTokenMassEntropy } from './sourcehourofdaytokenmassentropy.js';
import { buildDailyTokenGini } from './dailytokenginicoefficient.js';
import { buildSourceHourTopKMassShare } from './sourcehourofdaytopkmassshare.js';
import { buildDailyTokenZscoreExtremes } from './dailytokenzscoreextremes.js';
import { buildCumulativeTokensMidpoint } from './cumulativetokensmidpoint.js';
import { buildSourceIoRatioStability } from './sourceioratiostability.js';
import { buildSourceOutputTokensPerRowPercentiles } from './sourceoutputtokensperrowpercentiles.js';
import { buildSourceSingleDayMassConcentration } from './sourcesingledaymassconcentration.js';
import { buildSourceCumulativeMassHalfLifeDay } from './sourcecumulativemasshalflifeday.js';
import { buildSourceColdWarmRowRatio } from './sourcecoldwarmrowratio.js';
import { buildSourceReasoningShareByDayCv } from './sourcereasoningsharebydaycv.js';
import { buildSourceCacheShareByDayCv } from './sourcecachesharebydaycv.js';
import { buildSourceOutputTokensByHourCv } from './sourceoutputtokensbyhourcv.js';
import { buildSourceInputTokenTopRowShare } from './sourceinputtokentoprowshare.js';
import { buildSourceZeroOutputRowShare } from './sourcezerooutputrowshare.js';
import { buildSourceGapHoursCv } from './sourcegaphourscv.js';
import { buildSourceInputOutputCorrelationCoefficient } from './sourceinputoutputcorrelationcoefficient.js';
import { buildSourceFirstVsLastQuartileOutputMeanShift } from './sourcefirstvslastquartileoutputmeanshift.js';
import { buildSourceRowTokenSkewness } from './sourcerowtokenskewness.js';
import { buildSourceRowTokenKurtosis } from './sourcerowtokenkurtosis.js';
import { buildSourceRowTokenCoefficientOfVariation } from './sourcerowtokencoefficientofvariation.js';
import { buildSourceRowTokenMad } from './sourcerowtokenmad.js';
import { buildSourceRowTokenGini } from './sourcerowtokengini.js';
import { buildSourceSameModelStreak } from './sourcesamemodelstreak.js';
import { buildSourceRowTokenAutocorrelationLag1 } from './sourcerowtokenautocorrelationlag1.js';
import { buildSourceRowTokenIqrRatio } from './sourcerowtokeniqrratio.js';
import { buildSourceRowTokenBowleySkewness } from './sourcerowtokenbowleyskewness.js';
import { buildSourceRowTokenCoefficientOfQuartileDeviation } from './sourcerowtokencoefficientofquartiledeviation.js';
import { buildSourceRowTokenTrimean } from './sourcerowtokentrimean.js';
import { buildSourceRowTokenMidhinge } from './sourcerowtokenmidhinge.js';
import { buildSourceRowTokenMidRange } from './sourcerowtokenmidrange.js';
import { buildSourceRowTokenTrimMean25 } from './sourcerowtokentrimmean25.js';
import { buildSourceRowTokenHarmonicMean } from './sourcerowtokenharmonicmean.js';
import { buildSourceRowTokenQuadraticMean } from './sourcerowtokenquadraticmean.js';
import { buildSourceRowTokenContraharmonicMean } from './sourcerowtokencontraharmonicmean.js';
import { buildSourceRowTokenLehmer3Mean } from './sourcerowtokenlehmer3mean.js';
import { buildSourceRowTokenLehmer4Mean } from './sourcerowtokenlehmer4mean.js';
import { buildSourceRowTokenLehmer5Mean } from './sourcerowtokenlehmer5mean.js';
import { buildSourceRowTokenLehmer6Mean } from './sourcerowtokenlehmer6mean.js';
import { buildSourceRowTokenLehmer7Mean } from './sourcerowtokenlehmer7mean.js';
import { buildSourceRowTokenLehmer8Mean } from './sourcerowtokenlehmer8mean.js';
import { buildSourceRowTokenLehmer9Mean } from './sourcerowtokenlehmer9mean.js';
import { buildSourceRowTokenLehmer10Mean } from './sourcerowtokenlehmer10mean.js';
import { buildSourceRowTokenLehmer11Mean } from './sourcerowtokenlehmer11mean.js';
import { buildSourceRowTokenLehmer12Mean } from './sourcerowtokenlehmer12mean.js';
import { buildSourceRowTokenWinsorizedMean10 } from './sourcerowtokenwinsorizedmean10.js';
import { buildSourceRowTokenWinsorizedMean20 } from './sourcerowtokenwinsorizedmean20.js';
import { buildSourceRowTokenTrimMean10 } from './sourcerowtokentrimmean10.js';
import { buildSourceRowTokenTrimMean20 } from './sourcerowtokentrimmean20.js';
import { buildSourceRowTokenTrimMean30 } from './sourcerowtokentrimmean30.js';
import { buildSourceRowTokenHodgesLehmann } from './sourcerowtokenhodgeslehmann.js';
import { buildSourceRowTokenBroadenedMedian } from './sourcerowtokenbroadenedmedian.js';
import { buildSourceRowTokenMEstimatorHuber } from './sourcerowtokenmestimatorhuber.js';
import { buildSourceRowTokenMEstimatorTukey } from './sourcerowtokenmestimatortukey.js';
import { buildSourceRowTokenMEstimatorHampel } from './sourcerowtokenmestimatorhampel.js';
import { buildSourceRowTokenMEstimatorAndrews } from './sourcerowtokenmestimatorandrews.js';
import { buildSourceRowTokenMEstimatorWelsch } from './sourcerowtokenmestimatorwelsch.js';
import { buildSourceRowTokenMEstimatorCauchy } from './sourcerowtokenmestimatorcauchy.js';
import { buildSourceRowTokenMEstimatorGemanMcClure } from './sourcerowtokenmestimatorgemanmcclure.js';
import { buildSourceRowTokenTheilSenSlope } from './sourcerowtokentheilsenslope.js';
import { buildSourceRowTokenSiegelSlope } from './sourcerowtokensiegelslope.js';
import { buildSourceRowTokenPassingBablokSlope } from './sourcerowtokenpassingbablokslope.js';
import { buildSourceRowTokenDemingSlope } from './sourcerowtokendemingslope.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenLehmerNegOneMean } from './sourcerowtokenlehmernegonemean.js';
import { buildSourceRowTokenLehmerNegTwoMean } from './sourcerowtokenlehmernegtwomean.js';
import { buildSourceRowTokenLehmerNegThreeMean } from './sourcerowtokenlehmernegthreemean.js';
import { buildSourceRowTokenBurstinessCoefficient } from './sourcerowtokenburstinesscoefficient.js';
import { buildSourceRowTokenRunsTest } from './sourcerowtokenrunstest.js';
import { buildSourceRowTokenTurningPointCount } from './sourcerowtokenturningpointcount.js';
import { buildSourceRowTokenPermutationEntropy } from './sourcerowtokenpermutationentropy.js';
import { buildSourceRowTokenSampleEntropy } from './sourcerowtokensampleentropy.js';
import { buildSourceRowTokenApproximateEntropy } from './sourcerowtokenapproximateentropy.js';
import { buildSourceRowTokenTeagerKaiser } from './sourcerowtokenteagerkaiser.js';
import { buildSourceRowTokenCrestFactor } from './sourcerowtokencrestfactor.js';
import { buildSourceRowTokenSpectralFlatness } from './sourcerowtokenspectralflatness.js';
import { buildSourceRowTokenSpectralRolloff } from './sourcerowtokenspectralrolloff.js';
import { buildSourceRowTokenSpectralCentroid } from './sourcerowtokenspectralcentroid.js';
import { buildSourceRowTokenSpectralBandwidth } from './sourcerowtokenspectralbandwidth.js';
import { buildSourceRowTokenSpectralSkewness } from './sourcerowtokenspectralskewness.js';
import { buildSourceRowTokenSpectralKurtosis } from './sourcerowtokenspectralkurtosis.js';
import { buildSourceRowTokenSpectralEntropy } from './sourcerowtokenspectralentropy.js';
import { buildSourceRowTokenSpectralDecrease } from './sourcerowtokenspectraldecrease.js';
import { buildSourceRowTokenSpectralIrregularity } from './sourcerowtokenspectralirregularity.js';
import { buildSourceRowTokenTemporalCentroid } from './sourcerowtokentemporalcentroid.js';
import { buildSourceRowTokenTemporalSpread } from './sourcerowtokentemporalspread.js';
import { buildSourceRowTokenTemporalSkewness } from './sourcerowtokentemporalskewness.js';
import { buildSourceRowTokenTemporalKurtosis } from './sourcerowtokentemporalkurtosis.js';
import { buildSourceRowTokenTemporalFlatness } from './sourcerowtokentemporalflatness.js';
import { buildSourceRowTokenTemporalEntropy } from './sourcerowtokentemporalentropy.js';
import { buildSourceRowTokenHiguchiFd } from './sourcerowtokenhiguchifd.js';
import { buildSourceRowTokenKatzFd } from './sourcerowtokenkatzfd.js';
import { buildSourceRowTokenHjorthMobility } from './sourcerowtokenhjorthmobility.js';
import { buildSourceRowTokenHjorthComplexity } from './sourcerowtokenhjorthcomplexity.js';
import { buildSourceRowTokenZeroCrossingRate } from './sourcerowtokenzerocrossingrate.js';
import { buildSourceRowTokenPetrosianFd } from './sourcerowtokenpetrosianfd.js';
import { buildSourceRowTokenLempelZiv } from './sourcerowtokenlempelziv.js';
import { buildSourceRowTokenRenyiEntropy } from './sourcerowtokenrenyientropy.js';
import { buildSourceRowTokenDfa } from './sourcerowtokendfa.js';
import { buildSourceRowTokenMannKendallTrend } from './sourcerowtokenmannkendalltrend.js';
import { buildSourceRowTokenHurstRs } from './sourcerowtokenhurstrs.js';
import { buildSourcePeakHourOfDayArgmax } from './sourcepeakhourofdayargmax.js';
import { buildModelTenure } from './modeltenure.js';
import { buildProviderTenure } from './providertenure.js';
import { buildTenureDensityQuadrant } from './tenuredensityquadrant.js';
import { buildSourceTenure } from './sourcetenure.js';
import { buildBucketStreakLength } from './bucketstreaklength.js';
import { buildBucketGapDistribution } from './bucketgapdistribution.js';
import { buildSourceDecayHalfLife } from './sourcedecayhalflife.js';
import { buildBucketHandoffFrequency } from './buckethandofffrequency.js';
import { buildInterSourceHandoffLatency } from './intersourcehandofflatency.js';
import { buildSourcePairCooccurrence } from './sourcepaircooccurrence.js';
import { buildProviderSwitchingFrequency } from './providerswitchingfrequency.js';
import { buildFirstBucketOfDay } from './firstbucketofday.js';
import { buildLastBucketOfDay } from './lastbucketofday.js';
import { buildOutputTokenDecileDistribution } from './outputtokendeciledistribution.js';
import { buildInputTokenDecileDistribution } from './inputtokendeciledistribution.js';
import { buildActiveSpanPerDay } from './activespanperday.js';
import { buildSourceBreadthPerDay } from './sourcebreadthperday.js';
import { buildBucketDensityPercentile } from './bucketdensitypercentile.js';
import { buildHourOfWeek } from './hourofweek.js';
import { buildDeviceTenure } from './devicetenure.js';
import { buildTailShare } from './tailshare.js';
import { buildOutputInputRatio } from './outputinputratio.js';
import { buildModelMixEntropy } from './modelmixentropy.js';
import { buildTimeOfDay } from './timeofday.js';

interface CommonOpts {
  pewHome?: string;
  json?: boolean;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

const program = new Command();

program
  .name('pew-insights')
  .description('Local-first reports and analytics for your `pew` CLI usage.')
  .version('0.5.6')
  .option('--pew-home <path>', 'override pew state directory (default $PEW_HOME or ~/.config/pew)');

program
  .command('digest')
  .description('Token totals by day / source / model / hour for a window')
  .option('--since <spec>', 'window: 24h, 7d, 30d, all', '7d')
  .option('--by-project', 'add a top-projects breakdown using project_ref reverse mapping')
  .option('--json', 'emit JSON instead of a pretty table')
  .action(
    async (
      opts: { since: string; json?: boolean; byProject?: boolean },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts & { since: string };
        const paths = resolvePewPaths(common.pewHome);
        const since = resolveSince(opts.since);
        const [queue, sessions] = await Promise.all([readQueue(paths), readSessionQueue(paths)]);
        const digest = buildDigest(queue, sessions, since);

        let byProject: ReturnType<typeof attributeTokensByProject> | null = null;
        let labels: Map<string, string> | null = null;
        if (opts.byProject) {
          byProject = attributeTokensByProject(queue, sessions, since);
          // Resolve project labels via cached lookup (do not rescan).
          const cache = await readCache();
          labels = new Map();
          if (cache) {
            for (const e of cache.entries) {
              const safeBase = isPathDenylisted(e.basename) ? '<redacted>' : e.basename;
              labels.set(e.projectRef, safeBase);
            }
          }
        }

        if (opts.json || common.json) {
          const enriched = byProject
            ? {
                ...digest,
                byProject: {
                  unattributedTokens: byProject.unattributedTokens,
                  rows: byProject.rows.slice(0, 10).map((r) => ({
                    projectRef: r.projectRef,
                    label: labels?.get(r.projectRef) ?? null,
                    totalTokens: r.totalTokens,
                    bySource: r.bySource,
                  })),
                },
              }
            : digest;
          process.stdout.write(JSON.stringify(enriched, null, 2) + '\n');
        } else {
          process.stdout.write(renderDigest(digest) + '\n');
          if (byProject) {
            process.stdout.write('\nTop projects (proportional attribution)\n');
            process.stdout.write(
              `unattributed: ${byProject.unattributedTokens.toLocaleString()} tokens\n\n`,
            );
            const top = byProject.rows.slice(0, 10);
            for (const r of top) {
              const label = labels?.get(r.projectRef) ?? '(unresolved)';
              process.stdout.write(
                `  ${r.projectRef}  ${r.totalTokens.toLocaleString().padStart(14)}  ${label}\n`,
              );
              for (const s of r.bySource.slice(0, 5)) {
                process.stdout.write(
                  `      ${s.source.padEnd(18)} ${s.tokens.toLocaleString().padStart(12)}\n`,
                );
              }
            }
          }
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('status')
  .description('Sync queue + lock health')
  .option('--json', 'emit JSON instead of a pretty table')
  .action(async (opts: { json?: boolean }, cmd) => {
    try {
      const common = cmd.optsWithGlobals() as CommonOpts;
      const paths = resolvePewPaths(common.pewHome);
      const [state, queue, queueSize, sessionQueueSize, cursors, runsCount] = await Promise.all([
        readState(paths),
        readQueue(paths),
        fileSize(paths.queueJsonl),
        fileSize(paths.sessionQueueJsonl),
        readCursors(paths),
        countRuns(paths),
      ]);
      const status = buildStatus({
        pewHome: paths.home,
        state,
        queue,
        queueFileSize: queueSize,
        sessionQueueFileSize: sessionQueueSize,
        cursors,
        runsCountApprox: runsCount,
      });
      if (opts.json || common.json) {
        process.stdout.write(JSON.stringify(status, null, 2) + '\n');
      } else {
        process.stdout.write(renderStatus(status) + '\n');
      }
    } catch (e) {
      die(e);
    }
  });

program
  .command('sources')
  .description('Source × model token totals (pivot)')
  .option('--since <spec>', 'window: 24h, 7d, 30d, all', '7d')
  .option('--json', 'emit JSON instead of a pretty table')
  .action(async (opts: { since: string; json?: boolean }, cmd) => {
    try {
      const common = cmd.optsWithGlobals() as CommonOpts & { since: string };
      const paths = resolvePewPaths(common.pewHome);
      const queue = await readQueue(paths);
      const since = resolveSince(opts.since);
      const pivot = buildSourcesPivot(queue, since);
      if (opts.json || common.json) {
        process.stdout.write(JSON.stringify(pivot, null, 2) + '\n');
      } else {
        process.stdout.write(renderSources(pivot) + '\n');
      }
    } catch (e) {
      die(e);
    }
  });

program
  .command('report')
  .description('Render a self-contained HTML report')
  .option('--since <spec>', 'window: 24h, 7d, 30d, all', '7d')
  .option('--out <path>', 'output HTML file (default report.html)', 'report.html')
  .action(async (opts: { since: string; out: string }, cmd) => {
    try {
      const common = cmd.optsWithGlobals() as CommonOpts & { since: string };
      const paths = resolvePewPaths(common.pewHome);
      const since = resolveSince(opts.since);
      const [queue, sessions, qSize, sqSize, state, cursors, runsCount] = await Promise.all([
        readQueue(paths),
        readSessionQueue(paths),
        fileSize(paths.queueJsonl),
        fileSize(paths.sessionQueueJsonl),
        readState(paths),
        readCursors(paths),
        countRuns(paths),
      ]);
      const digest = buildDigest(queue, sessions, since);
      const status = buildStatus({
        pewHome: paths.home,
        state,
        queue,
        queueFileSize: qSize,
        sessionQueueFileSize: sqSize,
        cursors,
        runsCountApprox: runsCount,
      });
      // Cost + trend always populated for the HTML view; cheap to compute.
      const userRates = await readRatesFile(defaultRatesPath());
      const mergedRates = mergeRates(DEFAULT_RATES, userRates);
      const cost = computeCost(queue, since, mergedRates);
      const trend = buildTrend(queue, since, { windowDays: 14 });
      // Forecast: 14d lookback for the OLS fit; the forecast itself spans the
      // current UTC week. Always rendered — cheap and adds operational signal.
      const forecast = buildForecast(queue, { lookbackDays: 14 });
      // Budget: only render if the user has a budget config on disk. We never
      // synthesise a daily target for the HTML view (would mis-represent intent).
      const budgetCfg = await readBudgetFile(defaultBudgetPath());
      const budget = budgetCfg
        ? buildBudget(queue, mergedRates, budgetCfg, { windowDays: 14 })
        : null;
      const html = renderHtmlReport({
        pewHome: paths.home,
        digest,
        status,
        cost,
        trend,
        forecast,
        budget,
        generatedAt: new Date().toISOString(),
      });
      await fs.writeFile(opts.out, html, 'utf8');
      process.stdout.write(`wrote ${opts.out} (${html.length} bytes)\n`);
    } catch (e) {
      die(e);
    }
  });

program
  .command('top-projects')
  .description('Top N projects by attributed tokens, with reverse-mapped paths')
  .option('--since <spec>', 'window: 24h, 7d, 30d, all', '7d')
  .option('-n, --top <n>', 'number of projects to show (default 10)', '10')
  .option('--show-paths', 'include resolved paths (still denylist-filtered)')
  .option('--json', 'emit JSON instead of a pretty table')
  .action(
    async (
      opts: { since: string; top: string; showPaths?: boolean; json?: boolean },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts & { since: string };
        const paths = resolvePewPaths(common.pewHome);
        const since = resolveSince(opts.since);
        const topN = Number.parseInt(opts.top, 10);
        if (!Number.isFinite(topN) || topN < 1) {
          throw new Error(`--top must be a positive integer (got ${opts.top})`);
        }
        const [queue, sessions] = await Promise.all([
          readQueue(paths),
          readSessionQueue(paths),
        ]);
        const result = await buildTopProjects(queue, sessions, since, {
          topN,
          showPaths: opts.showPaths,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(result, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderTopProjects(result, { showPaths: opts.showPaths }) + '\n',
          );
          if (result.unresolvedCount > 0) {
            process.stdout.write(
              chalk.dim(
                `\n${result.unresolvedCount} project_ref(s) unresolved — run \`pew-insights projects --refresh\` to rebuild the lookup.\n`,
              ),
            );
          }
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('trend')
  .description('Day-over-day and week-over-week token deltas with ASCII sparklines')
  .option('--since <spec>', 'display window: 24h, 7d, 30d, all (deltas always use fixed 24h/7d offsets)', '14d')
  .option('--window <days>', 'number of days in the displayed sparkline (default 14)', '14')
  .option('--json', 'emit JSON instead of a pretty table')
  .action(async (opts: { since: string; window: string; json?: boolean }, cmd) => {
    try {
      const common = cmd.optsWithGlobals() as CommonOpts & { since: string };
      const paths = resolvePewPaths(common.pewHome);
      const since = resolveSince(opts.since);
      const windowDays = Number.parseInt(opts.window, 10);
      if (!Number.isFinite(windowDays) || windowDays < 2) {
        throw new Error(`--window must be an integer >= 2 (got ${opts.window})`);
      }
      const queue = await readQueue(paths);
      const report = buildTrend(queue, since, { windowDays });
      if (opts.json || common.json) {
        process.stdout.write(JSON.stringify(report, null, 2) + '\n');
      } else {
        process.stdout.write(renderTrend(report) + '\n');
      }
    } catch (e) {
      die(e);
    }
  });

program
  .command('cost')
  .description('Estimate $ cost from queue tokens × per-model rate table')
  .option('--since <spec>', 'window: 24h, 7d, 30d, all', '7d')
  .option('--rates <path>', 'JSON rates file (defaults to ~/.config/pew-insights/rates.json)')
  .option('--json', 'emit JSON instead of a pretty table')
  .action(async (opts: { since: string; rates?: string; json?: boolean }, cmd) => {
    try {
      const common = cmd.optsWithGlobals() as CommonOpts & { since: string };
      const paths = resolvePewPaths(common.pewHome);
      const since = resolveSince(opts.since);
      const ratesPath = opts.rates ?? defaultRatesPath();
      const userRates = await readRatesFile(ratesPath);
      const rates = mergeRates(DEFAULT_RATES, userRates);
      const queue = await readQueue(paths);
      const report = computeCost(queue, since, rates);
      if (opts.json || common.json) {
        process.stdout.write(
          JSON.stringify(
            {
              ...report,
              ratesSource: userRates ? ratesPath : 'defaults',
              modelsPriced: Object.keys(rates).length,
            },
            null,
            2,
          ) + '\n',
        );
      } else {
        process.stdout.write(renderCost(report) + '\n');
        process.stdout.write(
          chalk.dim(
            `\nrates source: ${userRates ? ratesPath : 'built-in defaults'}  (${Object.keys(rates).length} models priced)\n`,
          ),
        );
      }
    } catch (e) {
      die(e);
    }
  });

program
  .command('doctor')
  .description('Health checks against the pew state directory')
  .option('--json', 'emit JSON instead of a pretty table')
  .action(async (opts: { json?: boolean }, cmd) => {
    try {
      const common = cmd.optsWithGlobals() as CommonOpts;
      const paths = resolvePewPaths(common.pewHome);
      const exists = await pathExists(paths.home);

      let status = null;
      let queueSize = 0;
      let queueOffset = 0;
      let runsCount = 0;

      if (exists) {
        const [state, queue, qSize, sqSize, cursors, rCount] = await Promise.all([
          readState(paths),
          readQueue(paths),
          fileSize(paths.queueJsonl),
          fileSize(paths.sessionQueueJsonl),
          readCursors(paths),
          countRuns(paths),
        ]);
        queueSize = qSize;
        queueOffset = state.queue.offset;
        runsCount = rCount;
        status = buildStatus({
          pewHome: paths.home,
          state,
          queue,
          queueFileSize: qSize,
          sessionQueueFileSize: sqSize,
          cursors,
          runsCountApprox: rCount,
        });
      }

      const report = buildDoctor({
        pewHome: paths.home,
        pewHomeExists: exists,
        status,
        queueFileSize: queueSize,
        queueOffset,
        runsCount,
      });

      if (opts.json || common.json) {
        process.stdout.write(JSON.stringify(report, null, 2) + '\n');
      } else {
        process.stdout.write(renderDoctor(report) + '\n');
      }
      // Non-zero exit if any errors.
      if (report.findings.some((f) => f.severity === 'error')) {
        process.exitCode = 2;
      }
    } catch (e) {
      die(e);
    }
  });

program
  .command('projects')
  .description('Reverse-map session-queue project_ref hashes to project paths')
  .option('--show-paths', 'show full filesystem paths (still denylist-filtered)')
  .option('--refresh', 'force a fresh scan even if a cache exists')
  .option('--json', 'emit JSON instead of a pretty table')
  .option('--scan-root <path...>', 'override scan roots (repeatable)')
  .action(
    async (
      opts: { showPaths?: boolean; refresh?: boolean; json?: boolean; scanRoot?: string[] },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const sessions = await readSessionQueue(paths);

        // Tally sessions per project_ref so we can sort & summarise.
        const sessionsByRef = new Map<string, number>();
        for (const s of sessions) {
          const ref = s.project_ref || 'unknown';
          sessionsByRef.set(ref, (sessionsByRef.get(ref) ?? 0) + 1);
        }
        const observed = new Set(sessionsByRef.keys());

        let resolved: ResolvedRef[];
        const cachePath = defaultCachePath();

        if (!opts.refresh) {
          const cache = await readCache(cachePath);
          if (cache) {
            resolved = cache.entries.filter((e) => observed.has(e.projectRef));
          } else {
            resolved = await freshScan(observed, opts.scanRoot);
            await writeCache(
              { version: 1, generatedAt: new Date().toISOString(), entries: resolved },
              cachePath,
            );
          }
        } else {
          resolved = await freshScan(observed, opts.scanRoot);
          await writeCache(
            { version: 1, generatedAt: new Date().toISOString(), entries: resolved },
            cachePath,
          );
        }

        const rows = resolved
          .map((e) => ({
            ...e,
            sessions: sessionsByRef.get(e.projectRef) ?? 0,
          }))
          .sort((a, b) => b.sessions - a.sessions);

        if (opts.json || common.json) {
          // JSON output never includes denylisted paths.
          const safe = rows.map((r) => ({
            projectRef: r.projectRef,
            basename: isPathDenylisted(r.basename) ? '<redacted>' : r.basename,
            ...(opts.showPaths && !isPathDenylisted(r.path) ? { path: r.path } : {}),
            algo: r.algo,
            variant: r.variant,
            sessions: r.sessions,
          }));
          process.stdout.write(
            JSON.stringify(
              {
                cachePath,
                totalRefs: observed.size,
                resolvedRefs: rows.length,
                entries: safe,
              },
              null,
              2,
            ) + '\n',
          );
        } else {
          process.stdout.write(`pew-insights projects\n`);
          process.stdout.write(
            `cache: ${cachePath}\nresolved ${rows.length} of ${observed.size} project_refs\n\n`,
          );
          const headers = opts.showPaths
            ? ['project_ref', 'sessions', 'basename', 'path']
            : ['project_ref', 'sessions', 'basename'];
          process.stdout.write(headers.join('\t') + '\n');
          for (const r of rows) {
            const safeBase = isPathDenylisted(r.basename) ? '<redacted>' : r.basename;
            const cols = [
              r.projectRef,
              String(r.sessions),
              safeBase,
              ...(opts.showPaths ? [redactPath(r.path)] : []),
            ];
            process.stdout.write(cols.join('\t') + '\n');
          }
        }
      } catch (e) {
        die(e);
      }
    },
  );

async function freshScan(
  observed: Set<string>,
  scanRoots: string[] | undefined,
): Promise<ResolvedRef[]> {
  const candidates = await scanCandidates(scanRoots ? { roots: scanRoots } : {});
  const lookup = buildLookup(candidates, observed);
  return Array.from(lookup.values());
}

program
  .command('compact')
  .description('Archive flushed prefix of queue.jsonl / session-queue.jsonl and truncate the live file')
  .option('--confirm', 'actually mutate; without this the command is dry-run')
  .option('--json', 'emit JSON')
  .action(async (opts: { confirm?: boolean; json?: boolean }, cmd) => {
    try {
      const common = cmd.optsWithGlobals() as CommonOpts;
      const paths = resolvePewPaths(common.pewHome);
      const plan = await planCompaction(paths);

      const summary = {
        pewHome: paths.home,
        dryRun: !opts.confirm,
        blocked: plan.blocked,
        blockReason: plan.blockReason,
        trailingLockHolder: plan.trailingLockHolder,
        trailingLockAlive: plan.trailingLockAlive,
        plan: plan.entries.map((e) => ({
          name: e.name,
          liveSize: e.liveSize,
          offset: e.offset,
          evictableBytes: e.evictableBytes,
          archivePath: e.archivePath,
        })),
        executed: [] as Awaited<ReturnType<typeof executeCompaction>>,
      };

      if (opts.confirm && !plan.blocked) {
        summary.executed = await executeCompaction(paths, plan);
      }

      if (opts.json || common.json) {
        process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
      } else {
        process.stdout.write(`pew-insights compact ${opts.confirm ? '(LIVE)' : '(dry-run)'}\n`);
        process.stdout.write(`pew home: ${paths.home}\n`);
        if (plan.blocked) {
          process.stdout.write(`BLOCKED: ${plan.blockReason}\n`);
          process.exitCode = 2;
          return;
        }
        for (const e of plan.entries) {
          process.stdout.write(
            `  ${e.name}: live=${e.liveSize}B  offset=${e.offset}B  evictable=${e.evictableBytes}B  → ${e.archivePath}\n`,
          );
        }
        if (!opts.confirm) {
          process.stdout.write(`\nDry-run only. Re-run with --confirm to actually compact.\n`);
        } else {
          process.stdout.write('\nResults:\n');
          for (const r of summary.executed) {
            if (r.skipped) {
              process.stdout.write(`  ${r.name}: skipped (${r.reason})\n`);
            } else {
              process.stdout.write(
                `  ${r.name}: archived ${r.archivedBytes}B → ${r.archivePath}; live now ${r.newLiveBytes}B\n`,
              );
            }
          }
        }
      }
    } catch (e) {
      die(e);
    }
  });

program
  .command('gc-runs')
  .description('Move old runs/ entries into ~/.cache/pew-insights/archive/runs/')
  .option('--keep <n>', 'keep the most recent N runs (default 1000)', '1000')
  .option('--confirm', 'actually move files; without this the command is dry-run')
  .option('--json', 'emit JSON')
  .action(async (opts: { keep: string; confirm?: boolean; json?: boolean }, cmd) => {
    try {
      const common = cmd.optsWithGlobals() as CommonOpts;
      const paths = resolvePewPaths(common.pewHome);
      const keep = Number.parseInt(opts.keep, 10);
      if (!Number.isFinite(keep) || keep < 0) {
        throw new Error(`--keep must be a non-negative integer (got ${opts.keep})`);
      }
      const plan = await planGc(paths, { keep });
      let moved = 0;
      if (opts.confirm) {
        const r = await executeGc(plan);
        moved = r.moved;
      }
      if (opts.json || common.json) {
        process.stdout.write(
          JSON.stringify(
            {
              dryRun: !opts.confirm,
              totalRuns: plan.totalRuns,
              keepRecent: plan.keepRecent,
              keepers: plan.keepers.length,
              candidatesToMove: plan.candidates.length,
              archiveDir: plan.archiveDir,
              moved,
            },
            null,
            2,
          ) + '\n',
        );
      } else {
        process.stdout.write(`pew-insights gc-runs ${opts.confirm ? '(LIVE)' : '(dry-run)'}\n`);
        process.stdout.write(`runs/ entries: ${plan.totalRuns}\n`);
        process.stdout.write(`keep most recent: ${plan.keepRecent}\n`);
        process.stdout.write(`total keepers (recent ∪ daily-success): ${plan.keepers.length}\n`);
        process.stdout.write(`candidates to move: ${plan.candidates.length}\n`);
        process.stdout.write(`archive dir: ${plan.archiveDir}\n`);
        if (!opts.confirm) {
          process.stdout.write('\nDry-run only. Re-run with --confirm to actually move files.\n');
        } else {
          process.stdout.write(`\nMoved ${moved} files.\n`);
        }
      }
    } catch (e) {
      die(e);
    }
  });

function die(e: unknown): never {
  const msg = e instanceof Error ? e.stack ?? e.message : String(e);
  process.stderr.write(`pew-insights: ${msg}\n`);
  process.exit(1);
}

program
  .command('forecast')
  .description('Linear-regression forecast: tomorrow + week-end token totals with 95% CI')
  .option('--lookback <days>', 'days of history to fit on (default 14)', '14')
  .option('--json', 'emit JSON instead of a pretty table')
  .action(async (opts: { lookback: string; json?: boolean }, cmd) => {
    try {
      const common = cmd.optsWithGlobals() as CommonOpts;
      const paths = resolvePewPaths(common.pewHome);
      const lookback = Number.parseInt(opts.lookback, 10);
      if (!Number.isFinite(lookback) || lookback < 2) {
        throw new Error(`--lookback must be an integer >= 2 (got ${opts.lookback})`);
      }
      const queue = await readQueue(paths);
      const report = buildForecast(queue, { lookbackDays: lookback });
      if (opts.json || common.json) {
        process.stdout.write(JSON.stringify(report, null, 2) + '\n');
      } else {
        process.stdout.write(renderForecast(report) + '\n');
      }
    } catch (e) {
      die(e);
    }
  });

program
  .command('budget')
  .description('Track $ burn against a daily budget; show ETA to monthly breach')
  .option('--daily <usd>', 'daily budget in USD (overrides config file)')
  .option('--monthly <usd>', 'monthly cap in USD (otherwise daily × days-in-month)')
  .option('--config <path>', 'budget config file (default ~/.config/pew-insights/budget.json)')
  .option('--window <days>', 'rolling window for burn-rate average (default 7)', '7')
  .option('--rates <path>', 'rates file (defaults to cost rates path)')
  .option('--json', 'emit JSON')
  .action(
    async (
      opts: {
        daily?: string;
        monthly?: string;
        config?: string;
        window: string;
        rates?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);

        // Load budget config: --daily wins; else config file; else error.
        let cfgFromFile = await readBudgetFile(opts.config ?? defaultBudgetPath());
        let dailyUsd: number | undefined;
        if (opts.daily != null) dailyUsd = Number(opts.daily);
        else if (cfgFromFile) dailyUsd = cfgFromFile.dailyUsd;
        if (dailyUsd == null || !Number.isFinite(dailyUsd) || dailyUsd < 0) {
          throw new Error(
            `no budget configured. Pass --daily <usd> or write {"dailyUsd": N} to ${opts.config ?? defaultBudgetPath()}`,
          );
        }
        let monthlyUsd: number | undefined;
        if (opts.monthly != null) monthlyUsd = Number(opts.monthly);
        else if (cfgFromFile?.monthlyUsd != null) monthlyUsd = cfgFromFile.monthlyUsd;

        const windowDays = Number.parseInt(opts.window, 10);
        if (!Number.isFinite(windowDays) || windowDays < 1) {
          throw new Error(`--window must be a positive integer (got ${opts.window})`);
        }

        const ratesPath = opts.rates ?? defaultRatesPath();
        const userRates = await readRatesFile(ratesPath);
        const rates = mergeRates(DEFAULT_RATES, userRates);
        const queue = await readQueue(paths);

        const report = buildBudget(queue, rates, { dailyUsd, monthlyUsd }, { windowDays });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderBudget(report) + '\n');
        }

        if (report.status === 'breached') process.exitCode = 2;
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('compare')
  .description('A/B compare two windows by source or model with significance hint')
  .option('--preset <name>', 'preset window pair: this-week-vs-last-week | today-vs-yesterday | last-7d-vs-prior-7d')
  .option('--a-from <iso>', 'window A inclusive start (ISO)')
  .option('--a-until <iso>', 'window A exclusive end (ISO)')
  .option('--b-from <iso>', 'window B inclusive start (ISO)')
  .option('--b-until <iso>', 'window B exclusive end (ISO)')
  .option('--by <dim>', 'dimension: source | model (default model)', 'model')
  .option('--top <n>', 'cap rows shown (default 20)', '20')
  .option('--min-tokens <n>', 'drop keys whose A+B tokens < this threshold (default 0)', '0')
  .option('--json', 'emit JSON')
  .action(
    async (
      opts: {
        preset?: string;
        aFrom?: string;
        aUntil?: string;
        bFrom?: string;
        bUntil?: string;
        by: string;
        top: string;
        minTokens: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);

        let a: CompareWindow;
        let b: CompareWindow;
        if (opts.preset) {
          const pr = resolveComparePreset(opts.preset);
          if (!pr) throw new Error(`unknown --preset: ${opts.preset}`);
          a = pr.a;
          b = pr.b;
        } else {
          if (!opts.aFrom || !opts.aUntil || !opts.bFrom || !opts.bUntil) {
            throw new Error('either --preset or all of --a-from --a-until --b-from --b-until are required');
          }
          a = { label: 'A', from: new Date(opts.aFrom).toISOString(), until: new Date(opts.aUntil).toISOString() };
          b = { label: 'B', from: new Date(opts.bFrom).toISOString(), until: new Date(opts.bUntil).toISOString() };
        }

        const dim = opts.by as CompareDimension;
        if (dim !== 'source' && dim !== 'model') {
          throw new Error(`--by must be 'source' or 'model' (got ${opts.by})`);
        }
        const topN = Number.parseInt(opts.top, 10);
        if (!Number.isFinite(topN) || topN < 1) {
          throw new Error(`--top must be a positive integer (got ${opts.top})`);
        }
        const minTokens = Number.parseInt(opts.minTokens, 10);
        if (!Number.isFinite(minTokens) || minTokens < 0) {
          throw new Error(`--min-tokens must be a non-negative integer (got ${opts.minTokens})`);
        }

        const queue = await readQueue(paths);
        const report = buildCompare(queue, a, b, dim, { topN, minTokens });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderCompare(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('export')
  .description('Dump filtered events as CSV or Parquet-friendly NDJSON for downstream BI')
  .option('--entity <name>', 'queue | sessions (default queue)', 'queue')
  .option('--format <fmt>', 'csv | ndjson (default csv)', 'csv')
  .option('--since <spec>', 'lower bound: 24h, 7d, 30d, all, or ISO')
  .option('--until <iso>', 'upper bound (exclusive); ISO timestamp')
  .option('--source <substr>', 'case-insensitive substring filter on source')
  .option('--model <substr>', 'case-insensitive substring filter on normalised model name')
  .option('--out <path>', 'write to file instead of stdout')
  .option('--rates <path>', 'rates JSON; populates the `usd` column for queue exports')
  .action(
    async (
      opts: {
        entity: string;
        format: string;
        since?: string;
        until?: string;
        source?: string;
        model?: string;
        out?: string;
        rates?: string;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        if (opts.entity !== 'queue' && opts.entity !== 'sessions') {
          throw new Error(`--entity must be 'queue' or 'sessions' (got ${opts.entity})`);
        }
        if (opts.format !== 'csv' && opts.format !== 'ndjson') {
          throw new Error(`--format must be 'csv' or 'ndjson' (got ${opts.format})`);
        }
        const since = opts.since ? resolveSince(opts.since) : null;
        const until = opts.until ? new Date(opts.until).toISOString() : null;
        const filters = { since, until, source: opts.source, model: opts.model };

        let result;
        if (opts.entity === 'queue') {
          let rates = null;
          if (opts.rates !== undefined || opts.format === 'ndjson' || opts.format === 'csv') {
            // Try the user rates file (or default) but fall back to nothing — the
            // `usd` column is optional.
            const ratesPath = opts.rates ?? defaultRatesPath();
            try {
              const userRates = await readRatesFile(ratesPath);
              rates = mergeRates(DEFAULT_RATES, userRates);
            } catch {
              rates = DEFAULT_RATES;
            }
          }
          const queue = await readQueue(paths);
          result = exportQueue(queue, opts.format as ExportFormat, filters, rates);
        } else {
          const sessions = await readSessionQueue(paths);
          result = exportSessions(sessions, opts.format as ExportFormat, filters);
        }

        if (opts.out) {
          await fs.writeFile(opts.out, result.body, 'utf8');
          process.stderr.write(
            `wrote ${result.rowCount} rows (${result.body.length} bytes) to ${opts.out}\n`,
          );
        } else {
          process.stdout.write(result.body);
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('anomalies')
  .description('Flag days whose token total deviates >threshold σ from a trailing baseline')
  .option('--lookback <days>', 'days of history to score (default 30)', '30')
  .option('--baseline <days>', 'trailing baseline window size (default 7)', '7')
  .option('--threshold <z>', '|z| threshold for flagging (default 2.0)', '2.0')
  .option('--json', 'emit JSON')
  .action(
    async (
      opts: { lookback: string; baseline: string; threshold: string; json?: boolean },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);

        const lookback = Number.parseInt(opts.lookback, 10);
        const baseline = Number.parseInt(opts.baseline, 10);
        const threshold = Number(opts.threshold);
        if (!Number.isFinite(lookback) || lookback < 1) {
          throw new Error(`--lookback must be a positive integer (got ${opts.lookback})`);
        }
        if (!Number.isFinite(baseline) || baseline < 1) {
          throw new Error(`--baseline must be a positive integer (got ${opts.baseline})`);
        }
        if (!Number.isFinite(threshold) || threshold <= 0) {
          throw new Error(`--threshold must be > 0 (got ${opts.threshold})`);
        }

        const queue = await readQueue(paths);
        const report = buildAnomalies(queue, {
          lookbackDays: lookback,
          baselineDays: baseline,
          threshold,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderAnomalies(report) + '\n');
        }

        // Compose with cron alerting: non-zero exit when the most
        // recent day spiked HIGH. Mirrors `budget breached` (exit 2).
        if (report.recentHigh) process.exitCode = 2;
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('ratios')
  .description('Score cache-hit-ratio drift over a window using logit-space EWMA')
  .option('--lookback <days>', 'days of history to score (default 30)', '30')
  .option('--alpha <a>', 'EWMA alpha in (0, 1] — newer-sample weight (default 0.3)', '0.3')
  .option('--baseline <days>', 'trailing baseline window over EWMA values (default 7)', '7')
  .option('--threshold <z>', '|z| threshold for flagging in logit space (default 2.0)', '2.0')
  .option('--json', 'emit JSON')
  .action(
    async (
      opts: {
        lookback: string;
        alpha: string;
        baseline: string;
        threshold: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);

        const lookback = Number.parseInt(opts.lookback, 10);
        const alpha = Number(opts.alpha);
        const baseline = Number.parseInt(opts.baseline, 10);
        const threshold = Number(opts.threshold);
        if (!Number.isFinite(lookback) || lookback < 1) {
          throw new Error(`--lookback must be a positive integer (got ${opts.lookback})`);
        }
        if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 1) {
          throw new Error(`--alpha must be in (0, 1] (got ${opts.alpha})`);
        }
        if (!Number.isFinite(baseline) || baseline < 1) {
          throw new Error(`--baseline must be a positive integer (got ${opts.baseline})`);
        }
        if (!Number.isFinite(threshold) || threshold <= 0) {
          throw new Error(`--threshold must be > 0 (got ${opts.threshold})`);
        }

        const queue = await readQueue(paths);
        const report = buildRatiosReport(queue, {
          lookbackDays: lookback,
          alpha,
          baselineDays: baseline,
          threshold,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderRatios(report) + '\n');
        }

        // Compose with cron alerting: non-zero exit when the most
        // recent scored day drifted in either direction. Mirrors
        // `anomalies` (exit 2 on recent high). We exit on `recentLow`
        // too because a falling cache-hit ratio is the operational
        // signal that matters most — costs are climbing.
        if (report.recentHigh || report.recentLow) process.exitCode = 2;
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('dashboard')
  .description('One-screen operator view: queue health + token volume drift + cache-hit drift')
  .option('--lookback <days>', 'days of history for anomalies + ratios (default 30)', '30')
  .option('--baseline <days>', 'trailing baseline window for both (default 7)', '7')
  .option('--threshold <z>', '|z| threshold for flagging in both (default 2.0)', '2.0')
  .option('--alpha <a>', 'EWMA alpha for ratios in (0, 1] (default 0.3)', '0.3')
  .option('--json', 'emit JSON')
  .action(
    async (
      opts: {
        lookback: string;
        baseline: string;
        threshold: string;
        alpha: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);

        const lookback = Number.parseInt(opts.lookback, 10);
        const baseline = Number.parseInt(opts.baseline, 10);
        const threshold = Number(opts.threshold);
        const alpha = Number(opts.alpha);
        if (!Number.isFinite(lookback) || lookback < 1) {
          throw new Error(`--lookback must be a positive integer (got ${opts.lookback})`);
        }
        if (!Number.isFinite(baseline) || baseline < 1) {
          throw new Error(`--baseline must be a positive integer (got ${opts.baseline})`);
        }
        if (!Number.isFinite(threshold) || threshold <= 0) {
          throw new Error(`--threshold must be > 0 (got ${opts.threshold})`);
        }
        if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 1) {
          throw new Error(`--alpha must be in (0, 1] (got ${opts.alpha})`);
        }

        // Read everything in parallel — each builder is pure and
        // independent. Mirrors the parallelism `status` already does.
        const [state, queue, queueSize, sessionQueueSize, cursors, runsCount] =
          await Promise.all([
            readState(paths),
            readQueue(paths),
            fileSize(paths.queueJsonl),
            fileSize(paths.sessionQueueJsonl),
            readCursors(paths),
            countRuns(paths),
          ]);
        const status = buildStatus({
          pewHome: paths.home,
          state,
          queue,
          queueFileSize: queueSize,
          sessionQueueFileSize: sessionQueueSize,
          cursors,
          runsCountApprox: runsCount,
        });
        const anomalies = buildAnomalies(queue, {
          lookbackDays: lookback,
          baselineDays: baseline,
          threshold,
        });
        const ratios = buildRatiosReport(queue, {
          lookbackDays: lookback,
          baselineDays: baseline,
          threshold,
          alpha,
        });
        const dash = buildDashboard({ status, anomalies, ratios });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(dash, null, 2) + '\n');
        } else {
          process.stdout.write(renderDashboard(dash) + '\n');
        }

        // Exit 2 if EITHER dimension flags the most recent day —
        // mirrors the per-subcommand contract so existing cron
        // glue behaves the same when swapped to `dashboard`.
        if (dash.alerting) process.exitCode = 2;
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('heatmap')
  .description('Hour-of-day × day-of-week token-activity matrix (surfaces diurnal/weekly cycles)')
  .option('--lookback <days>', 'days of history to include (default 30)', '30')
  .option('--metric <name>', 'token field: total | input | cached | output', 'total')
  .option('--tz <name>', 'bucket in utc | local (default utc)', 'utc')
  .option('--json', 'emit JSON instead of a colored grid')
  .action(
    async (
      opts: {
        lookback: string;
        metric: string;
        tz: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);

        const lookback = Number.parseInt(opts.lookback, 10);
        if (!Number.isFinite(lookback) || lookback < 1) {
          throw new Error(`--lookback must be a positive integer (got ${opts.lookback})`);
        }
        const metric = opts.metric as HeatmapMetric;
        if (!['total', 'input', 'cached', 'output'].includes(metric)) {
          throw new Error(
            `--metric must be one of total | input | cached | output (got ${opts.metric})`,
          );
        }
        const tz = opts.tz as HeatmapTz;
        if (!['utc', 'local'].includes(tz)) {
          throw new Error(`--tz must be one of utc | local (got ${opts.tz})`);
        }

        const queue = await readQueue(paths);
        const heatmap = buildHeatmap(queue, {
          lookbackDays: lookback,
          metric,
          tz,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(heatmap, null, 2) + '\n');
        } else {
          process.stdout.write(renderHeatmap(heatmap) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('streaks')
  .description('Activity-cadence runs: longest active streak, longest gap, current run')
  .option('--lookback <days>', 'days of history to include (default 30)', '30')
  .option(
    '--min-tokens <n>',
    'minimum total_tokens for a day to count as ACTIVE (default 1)',
    '1',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        lookback: string;
        minTokens: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);

        const lookback = Number.parseInt(opts.lookback, 10);
        if (!Number.isFinite(lookback) || lookback < 1) {
          throw new Error(`--lookback must be a positive integer (got ${opts.lookback})`);
        }
        const minTokens = Number.parseInt(opts.minTokens, 10);
        if (!Number.isFinite(minTokens) || minTokens < 0) {
          throw new Error(`--min-tokens must be a non-negative integer (got ${opts.minTokens})`);
        }

        const queue = await readQueue(paths);
        const report = buildStreaks(queue, {
          lookbackDays: lookback,
          minTokens,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderStreaks(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('sessions')
  .description('Per-session shape: counts, durations, message volume, top groups by source/kind/project_ref')
  .option('--since <spec>', 'window: 24h, 7d, 30d, all', '7d')
  .option('--until <iso>', 'exclusive ISO upper bound on started_at (default: open-ended)')
  .option('--by <dim>', 'group dimension: source | kind | project_ref (default source)', 'source')
  .option('--top <n>', 'cap groups shown in the breakdown (default 10)', '10')
  .option(
    '--min-duration <seconds>',
    'drop sessions whose duration_seconds < this (default 0)',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since: string;
        until?: string;
        by: string;
        top: string;
        minDuration: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts & { since: string };
        const paths = resolvePewPaths(common.pewHome);

        const since = resolveSince(opts.since);
        const until = opts.until ? new Date(opts.until).toISOString() : null;
        const topN = Number.parseInt(opts.top, 10);
        if (!Number.isFinite(topN) || topN < 1) {
          throw new Error(`--top must be a positive integer (got ${opts.top})`);
        }
        const minDuration = Number.parseInt(opts.minDuration, 10);
        if (!Number.isFinite(minDuration) || minDuration < 0) {
          throw new Error(
            `--min-duration must be a non-negative integer in seconds (got ${opts.minDuration})`,
          );
        }
        if (opts.by !== 'source' && opts.by !== 'kind' && opts.by !== 'project_ref') {
          throw new Error(
            `--by must be one of source | kind | project_ref (got ${opts.by})`,
          );
        }

        const sessions = await readSessionQueue(paths);
        const report = buildSessions(sessions, {
          since,
          until,
          by: opts.by as SessionsDimension,
          topN,
          minDurationSeconds: minDuration,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSessions(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('gaps')
  .description('Find unusually long idle periods between sessions via empirical-quantile thresholds')
  .option('--since <spec>', 'window: 24h, 7d, 30d, all', '7d')
  .option('--until <iso>', 'exclusive ISO upper bound on started_at (default: open-ended)')
  .option('--quantile <q>', 'quantile threshold in (0,1] (default 0.9 — flag the longest 10%)', '0.9')
  .option('--min-gap <seconds>', 'absolute floor; gaps below this never flagged (default 0)', '0')
  .option('--top <n>', 'cap flagged rows shown (default 10)', '10')
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since: string;
        until?: string;
        quantile: string;
        minGap: string;
        top: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts & { since: string };
        const paths = resolvePewPaths(common.pewHome);

        const since = resolveSince(opts.since);
        const until = opts.until ? new Date(opts.until).toISOString() : null;
        const quantile = Number.parseFloat(opts.quantile);
        if (!Number.isFinite(quantile) || quantile <= 0 || quantile > 1) {
          throw new Error(`--quantile must be in (0,1] (got ${opts.quantile})`);
        }
        const minGap = Number.parseInt(opts.minGap, 10);
        if (!Number.isFinite(minGap) || minGap < 0) {
          throw new Error(`--min-gap must be a non-negative integer (got ${opts.minGap})`);
        }
        const topN = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(topN) || topN < 1) {
          throw new Error(`--top must be a positive integer (got ${opts.top})`);
        }

        const sessions = await readSessionQueue(paths);
        const report = buildGaps(sessions, {
          since,
          until,
          quantile,
          minGapSeconds: minGap,
          topN,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderGaps(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('velocity')
  .description('Tokens-per-minute during active hour-stretches (intensity, not totals)')
  .option('--lookback <hours>', 'hours of history ending at now (default 168)', '168')
  .option('--min-tokens <n>', 'minimum total_tokens for an hour to count as ACTIVE (default 1)', '1')
  .option('--top <n>', 'cap top-stretches table (default 10)', '10')
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: { lookback: string; minTokens: string; top: string; json?: boolean },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const lookback = Number.parseInt(opts.lookback, 10);
        if (!Number.isInteger(lookback) || lookback < 1) {
          throw new Error(`--lookback must be a positive integer (got ${opts.lookback})`);
        }
        const minTokens = Number.parseInt(opts.minTokens, 10);
        if (!Number.isFinite(minTokens) || minTokens < 0) {
          throw new Error(`--min-tokens must be >= 0 (got ${opts.minTokens})`);
        }
        const topN = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(topN) || topN < 1) {
          throw new Error(`--top must be a positive integer (got ${opts.top})`);
        }

        const queue = await readQueue(paths);
        const report = buildVelocity(queue, {
          lookbackHours: lookback,
          minTokensPerHour: minTokens,
          topN,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderVelocity(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('concurrency')
  .description('Peak overlapping sessions and time-at-each-level histogram')
  .option('--since <iso>', 'inclusive ISO lower bound on the sweep window')
  .option('--until <iso>', 'exclusive ISO upper bound on the sweep window')
  .option('--top <n>', 'cap on peakSessions[] (default 10)', '10')
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: { since?: string; until?: string; top: string; json?: boolean },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const topN = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(topN) || topN < 1) {
          throw new Error(`--top must be a positive integer (got ${opts.top})`);
        }

        const sessions = await readSessionQueue(paths);
        const report = buildConcurrency(sessions, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          topN,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderConcurrency(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('transitions')
  .description('Adjacency matrix of source-to-source session handoffs (with gap distribution)')
  .option('--since <iso>', 'inclusive ISO lower bound on started_at')
  .option('--until <iso>', 'exclusive ISO upper bound on started_at')
  .option('--by <dim>', "grouping dimension: source | kind | project_ref (default 'source')", 'source')
  .option('--max-gap-seconds <n>', 'max gap to count as a handoff (default 1800 = 30 min)', '1800')
  .option('--top <n>', 'top-N transitions to surface (default 10)', '10')
  .option('--min-count <n>', 'drop cells with count < n from the surfaced table (default 0)', '0')
  .option('--exclude-self-loops', 'drop A→A cells from the surfaced table', false)
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        by: string;
        maxGapSeconds: string;
        top: string;
        minCount: string;
        excludeSelfLoops?: boolean;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const topN = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(topN) || topN < 1) {
          throw new Error(`--top must be a positive integer (got ${opts.top})`);
        }
        const minCount = Number.parseInt(opts.minCount, 10);
        if (!Number.isInteger(minCount) || minCount < 0) {
          throw new Error(`--min-count must be a non-negative integer (got ${opts.minCount})`);
        }
        const maxGapSeconds = Number.parseFloat(opts.maxGapSeconds);
        if (!Number.isFinite(maxGapSeconds) || maxGapSeconds < 0) {
          throw new Error(`--max-gap-seconds must be a non-negative finite number (got ${opts.maxGapSeconds})`);
        }
        if (opts.by !== 'source' && opts.by !== 'kind' && opts.by !== 'project_ref') {
          throw new Error(`--by must be 'source' | 'kind' | 'project_ref' (got ${opts.by})`);
        }

        const sessions = await readSessionQueue(paths);
        const report = buildTransitions(sessions, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          by: opts.by as TransitionsDimension,
          maxGapSeconds,
          topN,
          minCount,
          excludeSelfLoops: opts.excludeSelfLoops ?? false,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderTransitions(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('agent-mix')
  .description('Per-group token share with HHI + Gini concentration scalars')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--by <dim>', "grouping dimension: source | model | kind (default 'source')", 'source')
  .option('--metric <name>', "token field: total | input | output | cached (default 'total')", 'total')
  .option('--top <n>', 'top-N groups to surface (default 10)', '10')
  .option('--min-tokens <n>', 'drop groups with tokens < n from the surfaced table (default 0)', '0')
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        by: string;
        metric: string;
        top: string;
        minTokens: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const topN = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(topN) || topN < 1) {
          throw new Error(`--top must be a positive integer (got ${opts.top})`);
        }
        const minTokens = Number.parseInt(opts.minTokens, 10);
        if (!Number.isInteger(minTokens) || minTokens < 0) {
          throw new Error(`--min-tokens must be a non-negative integer (got ${opts.minTokens})`);
        }
        if (opts.by !== 'source' && opts.by !== 'model' && opts.by !== 'kind') {
          throw new Error(`--by must be 'source' | 'model' | 'kind' (got ${opts.by})`);
        }
        if (
          opts.metric !== 'total' &&
          opts.metric !== 'input' &&
          opts.metric !== 'output' &&
          opts.metric !== 'cached'
        ) {
          throw new Error(`--metric must be 'total' | 'input' | 'output' | 'cached' (got ${opts.metric})`);
        }

        const queue = await readQueue(paths);
        const report = buildAgentMix(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          by: opts.by as AgentMixDimension,
          metric: opts.metric as AgentMixMetric,
          topN,
          minTokens,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderAgentMix(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('session-lengths')
  .description('Binned histogram of session duration_seconds with quantile waypoints (p50/p90/p95/p99/max)')
  .option('--since <iso>', 'inclusive ISO lower bound on started_at')
  .option('--until <iso>', 'exclusive ISO upper bound on started_at')
  .option('--by <dim>', "split dimension: all | source | kind (default 'all')", 'all')
  .option('--min-duration-seconds <n>', 'drop sessions shorter than this (default 0)', '0')
  .option(
    '--edges <list>',
    `comma-separated bin upper-edges in seconds, strictly ascending (default ${DEFAULT_LENGTH_EDGES_SECONDS.join(',')})`,
  )
  .option('--unit <name>', "display unit for durations: auto | seconds | minutes | hours (default 'auto')", 'auto')
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        by: string;
        minDurationSeconds: string;
        edges?: string;
        unit: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minDurationSeconds = Number.parseFloat(opts.minDurationSeconds);
        if (!Number.isFinite(minDurationSeconds) || minDurationSeconds < 0) {
          throw new Error(`--min-duration-seconds must be a non-negative finite number (got ${opts.minDurationSeconds})`);
        }
        if (opts.by !== 'all' && opts.by !== 'source' && opts.by !== 'kind') {
          throw new Error(`--by must be 'all' | 'source' | 'kind' (got ${opts.by})`);
        }
        if (
          opts.unit !== 'auto' &&
          opts.unit !== 'seconds' &&
          opts.unit !== 'minutes' &&
          opts.unit !== 'hours'
        ) {
          throw new Error(`--unit must be 'auto' | 'seconds' | 'minutes' | 'hours' (got ${opts.unit})`);
        }
        let edgesSeconds: number[] | undefined;
        if (opts.edges != null && opts.edges.trim().length > 0) {
          edgesSeconds = opts.edges.split(',').map((s) => {
            const v = Number.parseFloat(s.trim());
            if (!Number.isFinite(v) || v <= 0) {
              throw new Error(`--edges entries must be positive finite numbers (got '${s}')`);
            }
            return v;
          });
        }

        const sessions = await readSessionQueue(paths);
        const report = buildSessionLengths(sessions, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          by: opts.by as SessionLengthsDimension,
          minDurationSeconds,
          edgesSeconds,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSessionLengths(report, { unit: opts.unit as SessionLengthsUnit }) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('reply-ratio')
  .description('Distribution of per-session assistant_messages / user_messages with quantile waypoints')
  .option('--since <iso>', 'inclusive ISO lower bound on started_at')
  .option('--until <iso>', 'exclusive ISO upper bound on started_at')
  .option('--by <dim>', "split dimension: all | source | kind (default 'all')", 'all')
  .option('--min-total-messages <n>', 'drop sessions with total_messages < n (default 2)', '2')
  .option(
    '--edges <list>',
    `comma-separated bin upper-edges on the ratio scale, strictly ascending (default ${DEFAULT_RATIO_EDGES.join(',')})`,
  )
  .option(
    '--threshold <n>',
    'report aboveThresholdShare = fraction of sessions with ratio > n (default unset)',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        by: string;
        minTotalMessages: string;
        edges?: string;
        threshold?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minTotalMessages = Number.parseFloat(opts.minTotalMessages);
        if (!Number.isFinite(minTotalMessages) || minTotalMessages < 0) {
          throw new Error(`--min-total-messages must be a non-negative finite number (got ${opts.minTotalMessages})`);
        }
        if (opts.by !== 'all' && opts.by !== 'source' && opts.by !== 'kind') {
          throw new Error(`--by must be 'all' | 'source' | 'kind' (got ${opts.by})`);
        }
        let edges: number[] | undefined;
        if (opts.edges != null && opts.edges.trim().length > 0) {
          edges = opts.edges.split(',').map((s) => {
            const v = Number.parseFloat(s.trim());
            if (!Number.isFinite(v) || v <= 0) {
              throw new Error(`--edges entries must be positive finite numbers (got '${s}')`);
            }
            return v;
          });
        }
        let threshold: number | undefined;
        if (opts.threshold != null && opts.threshold.length > 0) {
          const v = Number.parseFloat(opts.threshold);
          if (!Number.isFinite(v) || v <= 0) {
            throw new Error(`--threshold must be a positive finite number (got '${opts.threshold}')`);
          }
          threshold = v;
        }

        const sessions = await readSessionQueue(paths);
        const report = buildReplyRatio(sessions, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          by: opts.by as ReplyRatioDimension,
          minTotalMessages,
          edges,
          threshold,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderReplyRatio(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('turn-cadence')
  .description('Distribution of per-session avg seconds between operator turns (duration_seconds / user_messages)')
  .option('--since <iso>', 'inclusive ISO lower bound on started_at')
  .option('--until <iso>', 'exclusive ISO upper bound on started_at')
  .option('--by <dim>', "split dimension: all | source | kind (default 'all')", 'all')
  .option('--min-duration-seconds <n>', 'drop sessions with duration_seconds < n (default 1)', '1')
  .option(
    '--min-user-messages <n>',
    'drop sessions with user_messages < n (default 1; set 2 to exclude single-prompt sessions where cadence collapses into pure duration)',
    '1',
  )
  .option(
    '--edges <list>',
    `comma-separated bin upper-edges in seconds, strictly ascending (default ${DEFAULT_CADENCE_EDGES_SECONDS.join(',')})`,
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        by: string;
        minDurationSeconds: string;
        minUserMessages: string;
        edges?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minDurationSeconds = Number.parseFloat(opts.minDurationSeconds);
        if (!Number.isFinite(minDurationSeconds) || minDurationSeconds < 0) {
          throw new Error(
            `--min-duration-seconds must be a non-negative finite number (got ${opts.minDurationSeconds})`,
          );
        }
        const minUserMessages = Number.parseFloat(opts.minUserMessages);
        if (!Number.isFinite(minUserMessages) || minUserMessages < 1) {
          throw new Error(
            `--min-user-messages must be a finite number >= 1 (got ${opts.minUserMessages})`,
          );
        }
        if (opts.by !== 'all' && opts.by !== 'source' && opts.by !== 'kind') {
          throw new Error(`--by must be 'all' | 'source' | 'kind' (got ${opts.by})`);
        }
        let edges: number[] | undefined;
        if (opts.edges != null && opts.edges.trim().length > 0) {
          edges = opts.edges.split(',').map((s) => {
            const v = Number.parseFloat(s.trim());
            if (!Number.isFinite(v) || v <= 0) {
              throw new Error(`--edges entries must be positive finite numbers (got '${s}')`);
            }
            return v;
          });
        }

        const sessions = await readSessionQueue(paths);
        const report = buildTurnCadence(sessions, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          by: opts.by as TurnCadenceDimension,
          minDurationSeconds,
          minUserMessages,
          edges,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderTurnCadence(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-run-lengths')
  .description(
    'Distribution of consecutive same-source session run-lengths (operator stickiness on a source before switching)',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on started_at')
  .option('--until <iso>', 'exclusive ISO upper bound on started_at')
  .option(
    '--min-runs <n>',
    'drop sources whose post-window run-count is < n (default 1; sparse sources counted as droppedSparseSources)',
    '1',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--filter-source <list>',
    'comma-separated source allowlist; sessions whose source is not in the list are dropped before run computation and counted as droppedByFilterSource',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        minRuns: string;
        top?: string;
        filterSource?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRuns = Number.parseFloat(opts.minRuns);
        if (!Number.isFinite(minRuns) || minRuns < 1) {
          throw new Error(`--min-runs must be a finite number >= 1 (got ${opts.minRuns})`);
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        let filterSources: string[] | undefined;
        if (opts.filterSource != null && opts.filterSource.trim().length > 0) {
          filterSources = opts.filterSource
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          if (filterSources.length === 0) {
            throw new Error(`--filter-source must contain at least one non-empty source`);
          }
        }

        const sessions = await readSessionQueue(paths);
        const report = buildSourceRunLengths(sessions, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minRuns,
          top,
          filterSources,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRunLengths(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('hour-of-day-source-mix-entropy')
  .description(
    'Per UTC hour-of-day Shannon entropy of per-source token share (mono- vs poly-source hours)',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--min-tokens <n>',
    'hide hours with fewer than n total tokens; their counts surface as droppedSparseHours (default 0)',
    '0',
  )
  .option(
    '--top-k <n>',
    'cap hours[] to the top K by entropyBits desc (most poly-source hours first); ties by hour asc; hidden hours surface as droppedBelowTopK; global rollup unchanged',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: { since?: string; until?: string; minTokens: string; topK?: string; json?: boolean },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minTokens = Number.parseFloat(opts.minTokens);
        if (!Number.isFinite(minTokens) || minTokens < 0) {
          throw new Error(
            `--min-tokens must be a non-negative finite number (got ${opts.minTokens})`,
          );
        }
        let topK: number | null = null;
        if (opts.topK != null) {
          const t = Number.parseFloat(opts.topK);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top-k must be a positive integer (got ${opts.topK})`);
          }
          topK = t;
        }
        const queue = await readQueue(paths);
        const report = buildHourOfDaySourceMixEntropy(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minTokens,
          topK,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderHourOfDaySourceMixEntropy(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('bucket-token-gini')
  .description(
    "Per-source Gini coefficient of token mass across the source's active UTC hour buckets (steady vs bursty tools)",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--min-buckets <n>',
    'hide sources active in fewer than n hour buckets; suppressed sources surface as droppedBelowMinBuckets (default 1)',
    '1',
  )
  .option(
    '--filter-source <list>',
    'comma-separated source allowlist; rows whose source is not in the list are dropped before per-source aggregation',
  )
  .option(
    '--top-k <n>',
    'cap sources[] to the top K by gini desc (then tokens desc, source asc); hidden sources surface as droppedBelowTopK; global rollup unchanged',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        minBuckets: string;
        filterSource?: string;
        topK?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minBuckets = Number.parseInt(opts.minBuckets, 10);
        if (!Number.isFinite(minBuckets) || minBuckets < 1) {
          throw new Error(
            `--min-buckets must be a positive integer (got ${opts.minBuckets})`,
          );
        }
        let topK: number | null = null;
        if (opts.topK != null) {
          const t = Number.parseFloat(opts.topK);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top-k must be a positive integer (got ${opts.topK})`);
          }
          topK = t;
        }
        let filterSources: string[] | undefined;
        if (opts.filterSource != null && opts.filterSource.trim().length > 0) {
          filterSources = opts.filterSource
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          if (filterSources.length === 0) {
            throw new Error('--filter-source must contain at least one non-empty source');
          }
        }
        const queue = await readQueue(paths);
        const report = buildBucketTokenGini(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minBuckets,
          filterSources,
          topK,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderBucketTokenGini(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('hour-of-day-token-skew')
  .description(
    'Per UTC hour-of-day, sample skewness (Fisher–Pearson g1) of per-day total_tokens — separates steady hours from rare-burst hours',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--min-days <n>',
    'hide hours observed on fewer than n distinct UTC days; suppressed hours surface as droppedBelowMinDays (default 2 — structural minimum for a non-zero m2)',
    '2',
  )
  .option(
    '--top-k <n>',
    'cap hours[] to the top K by |skew| desc (then tokens desc, hour asc); hidden hours surface as droppedBelowTopK; global rollup unchanged',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        minDays: string;
        topK?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minDays = Number.parseInt(opts.minDays, 10);
        if (!Number.isFinite(minDays) || minDays < 2) {
          throw new Error(
            `--min-days must be an integer >= 2 (got ${opts.minDays})`,
          );
        }
        let topK: number | null = null;
        if (opts.topK != null) {
          const t = Number.parseFloat(opts.topK);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top-k must be a positive integer (got ${opts.topK})`);
          }
          topK = t;
        }
        const queue = await readQueue(paths);
        const report = buildHourOfDayTokenSkew(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minDays,
          topK,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderHourOfDayTokenSkew(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-rank-churn')
  .description(
    'Day-over-day instability of the source-by-tokens leaderboard via normalised Spearman footrule on adjacent UTC dates',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--min-days <n>',
    'drop sources observed on fewer than n distinct UTC days; suppressed sources surface as droppedBelowMinDays (default 1)',
    '1',
  )
  .option(
    '--top-k <n>',
    'cap sources[] to the top K by meanRank asc (then source asc); hidden sources surface as droppedBelowTopK; global rollup unchanged',
  )
  .option(
    '--min-pair-union <n>',
    'drop adjacent UTC-day pairs whose union of sources is below n (default 2; raise to 3 to suppress the polarising n=2 case where footrule is forced to 0 or 1)',
    '2',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        minDays: string;
        topK?: string;
        minPairUnion: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minDays = Number.parseInt(opts.minDays, 10);
        if (!Number.isFinite(minDays) || minDays < 1) {
          throw new Error(
            `--min-days must be an integer >= 1 (got ${opts.minDays})`,
          );
        }
        let topK: number | null = null;
        if (opts.topK != null) {
          const t = Number.parseFloat(opts.topK);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top-k must be a positive integer (got ${opts.topK})`);
          }
          topK = t;
        }
        const minPairUnion = Number.parseInt(opts.minPairUnion, 10);
        if (!Number.isFinite(minPairUnion) || minPairUnion < 2) {
          throw new Error(
            `--min-pair-union must be an integer >= 2 (got ${opts.minPairUnion})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRankChurn(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minDays,
          topK,
          minPairUnion,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRankChurn(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-debut-recency')
  .description(
    'Per-source debut/recency on the calendar plus a corpus-end newcomer rollup (debutShare = tokens in first debutWindowFraction of own tenure)',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--model <id>', 'restrict to a single normalised model id')
  .option(
    '--min-buckets <n>',
    'drop sources with fewer than n distinct active buckets from the per-source table (default 0); newcomer rollup is unaffected',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key for sources[]: 'recency' (default) | 'tokens' | 'tenure' | 'debutshare' | 'idle'",
    'recency',
  )
  .option(
    '--debut-window-fraction <f>',
    'fraction of each source\u2019s tenure used as its debut window for debutShare; must be in (0, 1] (default 0.25)',
    '0.25',
  )
  .option(
    '--debut-share-min <f>',
    'drop sources whose debutShare is below f from the per-source table; must be in [0, 1] (default 0); suppressed rows surface as droppedBelowDebutShareMin',
    '0',
  )
  .option(
    '--newcomer-window-days <n>',
    'days back from corpus end (asOf) to count as the newcomer cohort for the global rollup; must be > 0 (default 7)',
    '7',
  )
  .option(
    '--as-of <iso>',
    'override the corpus-end anchor; defaults to the latest hour_start across the kept window',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        model?: string;
        minBuckets: string;
        top?: string;
        sort: string;
        debutWindowFraction: string;
        debutShareMin: string;
        newcomerWindowDays: string;
        asOf?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minBuckets = Number.parseInt(opts.minBuckets, 10);
        if (!Number.isFinite(minBuckets) || minBuckets < 0) {
          throw new Error(
            `--min-buckets must be a non-negative integer (got ${opts.minBuckets})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const sort = opts.sort;
        if (
          sort !== 'recency' &&
          sort !== 'tokens' &&
          sort !== 'tenure' &&
          sort !== 'debutshare' &&
          sort !== 'idle'
        ) {
          throw new Error(
            `--sort must be 'recency' | 'tokens' | 'tenure' | 'debutshare' | 'idle' (got ${opts.sort})`,
          );
        }
        const debutWindowFraction = Number.parseFloat(opts.debutWindowFraction);
        if (
          !Number.isFinite(debutWindowFraction) ||
          debutWindowFraction <= 0 ||
          debutWindowFraction > 1
        ) {
          throw new Error(
            `--debut-window-fraction must be in (0, 1] (got ${opts.debutWindowFraction})`,
          );
        }
        const debutShareMin = Number.parseFloat(opts.debutShareMin);
        if (
          !Number.isFinite(debutShareMin) ||
          debutShareMin < 0 ||
          debutShareMin > 1
        ) {
          throw new Error(
            `--debut-share-min must be in [0, 1] (got ${opts.debutShareMin})`,
          );
        }
        const newcomerWindowDays = Number.parseFloat(opts.newcomerWindowDays);
        if (!Number.isFinite(newcomerWindowDays) || newcomerWindowDays <= 0) {
          throw new Error(
            `--newcomer-window-days must be > 0 (got ${opts.newcomerWindowDays})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceDebutRecency(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          model: opts.model ?? null,
          minBuckets,
          top,
          sort: sort as
            | 'recency'
            | 'tokens'
            | 'tenure'
            | 'debutshare'
            | 'idle',
          debutWindowFraction,
          debutShareMin,
          newcomerWindowDays,
          asOf: opts.asOf ?? null,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceDebutRecency(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-active-day-streak')
  .description(
    "Per-source longest run of consecutive UTC calendar days with at least one positive-token bucket (habit-consistency lens orthogonal to source-tenure / source-run-lengths / bucket-streak-length)",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--model <id>', 'restrict to a single normalised model id')
  .option('--source <key>', 'restrict to a single source key')
  .option(
    '--min-days <n>',
    'drop sources with fewer than n active days from the per-source table (default 1); display filter only',
    '1',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + min-days; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key for sources[]: 'tokens' (default) | 'streak' | 'density' | 'current' | 'days' | 'source'",
    'tokens',
  )
  .option(
    '--density-min <f>',
    'drop rows whose density (activeDays/tenureDays) is below f from the per-source table; must be in [0, 1] (default 0); suppressed rows surface as droppedBelowDensityMin',
    '0',
  )
  .option(
    '--min-longest-streak <n>',
    'drop rows whose longestStreak is strictly below n from the per-source table; must be a positive integer (default 1 = no-op); suppressed rows surface as droppedBelowMinLongestStreak',
    '1',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        model?: string;
        source?: string;
        minDays: string;
        top?: string;
        sort: string;
        densityMin: string;
        minLongestStreak: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minDays = Number.parseInt(opts.minDays, 10);
        if (!Number.isFinite(minDays) || minDays < 1) {
          throw new Error(
            `--min-days must be a positive integer (got ${opts.minDays})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const sort = opts.sort;
        if (
          sort !== 'tokens' &&
          sort !== 'streak' &&
          sort !== 'density' &&
          sort !== 'current' &&
          sort !== 'days' &&
          sort !== 'source'
        ) {
          throw new Error(
            `--sort must be 'tokens' | 'streak' | 'density' | 'current' | 'days' | 'source' (got ${opts.sort})`,
          );
        }
        const densityMin = Number.parseFloat(opts.densityMin);
        if (!Number.isFinite(densityMin) || densityMin < 0 || densityMin > 1) {
          throw new Error(
            `--density-min must be in [0, 1] (got ${opts.densityMin})`,
          );
        }
        const minLongestStreak = Number.parseInt(opts.minLongestStreak, 10);
        if (
          !Number.isFinite(minLongestStreak) ||
          minLongestStreak < 1 ||
          !Number.isInteger(minLongestStreak)
        ) {
          throw new Error(
            `--min-longest-streak must be a positive integer (got ${opts.minLongestStreak})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceActiveDayStreak(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          model: opts.model ?? null,
          source: opts.source ?? null,
          minDays,
          top,
          sort: sort as
            | 'tokens'
            | 'streak'
            | 'density'
            | 'current'
            | 'days'
            | 'source',
          densityMin,
          minLongestStreak,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceActiveDayStreak(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-dry-spell')
  .description(
    "Per-source longest run of consecutive UTC inactive days strictly inside tenure (worst-gap geometry — orthogonal complement to source-active-day-streak)",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--model <id>', 'restrict to a single normalised model id')
  .option('--source <key>', 'restrict to a single source key')
  .option(
    '--min-days <n>',
    'drop sources with fewer than n active days (default 1); display filter only',
    '1',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters',
  )
  .option(
    '--sort <key>',
    "sort key: 'longest' (default) | 'fraction' | 'tokens' | 'inactive' | 'mean' | 'source'",
    'longest',
  )
  .option(
    '--min-longest <n>',
    'drop rows whose longestDrySpell is strictly below n; non-negative integer (default 0 = no-op); use 1 to hide perfect-attendance sources',
    '0',
  )
  .option(
    '--min-fraction <f>',
    'drop rows whose drySpellFraction (inactiveDays/tenureDays) is strictly below f; must be in [0, 1) (default 0 = no-op); use 0.5 to keep only sources whose inactivity dominates tenure',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        model?: string;
        source?: string;
        minDays: string;
        top?: string;
        sort: string;
        minLongest: string;
        minFraction: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minDays = Number.parseInt(opts.minDays, 10);
        if (!Number.isFinite(minDays) || minDays < 1) {
          throw new Error(
            `--min-days must be a positive integer (got ${opts.minDays})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const sort = opts.sort;
        if (
          sort !== 'longest' &&
          sort !== 'fraction' &&
          sort !== 'tokens' &&
          sort !== 'inactive' &&
          sort !== 'mean' &&
          sort !== 'source'
        ) {
          throw new Error(
            `--sort must be 'longest' | 'fraction' | 'tokens' | 'inactive' | 'mean' | 'source' (got ${opts.sort})`,
          );
        }
        const minLongest = Number.parseInt(opts.minLongest, 10);
        if (
          !Number.isFinite(minLongest) ||
          minLongest < 0 ||
          !Number.isInteger(minLongest)
        ) {
          throw new Error(
            `--min-longest must be a non-negative integer (got ${opts.minLongest})`,
          );
        }
        const minFraction = Number.parseFloat(opts.minFraction);
        if (
          !Number.isFinite(minFraction) ||
          minFraction < 0 ||
          minFraction >= 1
        ) {
          throw new Error(
            `--min-fraction must be in [0, 1) (got ${opts.minFraction})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceDrySpell(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          model: opts.model ?? null,
          source: opts.source ?? null,
          minDays,
          top,
          sort: sort as
            | 'longest'
            | 'fraction'
            | 'tokens'
            | 'inactive'
            | 'mean'
            | 'source',
          minLongest,
          minFraction,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceDrySpell(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('message-volume')
  .description('Distribution of per-session total_messages with quantile waypoints')
  .option('--since <iso>', 'inclusive ISO lower bound on started_at')
  .option('--until <iso>', 'exclusive ISO upper bound on started_at')
  .option('--by <dim>', "split dimension: all | source | kind (default 'all')", 'all')
  .option('--min-total-messages <n>', 'drop sessions with total_messages < n (default 1)', '1')
  .option(
    '--edges <list>',
    `comma-separated bin upper-edges in messages, strictly ascending (default ${DEFAULT_VOLUME_EDGES.join(',')})`,
  )
  .option(
    '--threshold <n>',
    'report aboveThresholdShare = fraction of sessions with total_messages > n (default unset)',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        by: string;
        minTotalMessages: string;
        edges?: string;
        threshold?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minTotalMessages = Number.parseFloat(opts.minTotalMessages);
        if (!Number.isFinite(minTotalMessages) || minTotalMessages < 0) {
          throw new Error(
            `--min-total-messages must be a non-negative finite number (got ${opts.minTotalMessages})`,
          );
        }
        if (opts.by !== 'all' && opts.by !== 'source' && opts.by !== 'kind') {
          throw new Error(`--by must be 'all' | 'source' | 'kind' (got ${opts.by})`);
        }
        let edges: number[] | undefined;
        if (opts.edges != null && opts.edges.trim().length > 0) {
          edges = opts.edges.split(',').map((s) => {
            const v = Number.parseFloat(s.trim());
            if (!Number.isFinite(v) || v <= 0) {
              throw new Error(`--edges entries must be positive finite numbers (got '${s}')`);
            }
            return v;
          });
        }
        let threshold: number | undefined;
        if (opts.threshold != null && opts.threshold.length > 0) {
          const v = Number.parseFloat(opts.threshold);
          if (!Number.isFinite(v) || v <= 0) {
            throw new Error(
              `--threshold must be a positive finite number (got '${opts.threshold}')`,
            );
          }
          threshold = v;
        }

        const sessions = await readSessionQueue(paths);
        const report = buildMessageVolume(sessions, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          by: opts.by as MessageVolumeDimension,
          minTotalMessages,
          edges,
          threshold,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderMessageVolume(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('model-switching')
  .description('Sessions whose snapshots span >1 model; switched-share, distinct-model histogram, top from→to transitions')
  .option('--since <iso>', 'inclusive ISO lower bound on started_at')
  .option('--until <iso>', 'exclusive ISO upper bound on started_at')
  .option('--by <dim>', "split dimension: all | source (default 'all')", 'all')
  .option('--top <n>', 'max number of (from→to) transition pairs to emit (default 10)', '10')
  .option(
    '--min-switches <n>',
    "minimum distinct models a session must touch to count as 'switched' (default 2; set 3+ to focus on heavier switching)",
    '2',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        by: string;
        top: string;
        minSwitches: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        if (opts.by !== 'all' && opts.by !== 'source') {
          throw new Error(`--by must be 'all' | 'source' (got ${opts.by})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isFinite(top) || top <= 0) {
          throw new Error(`--top must be a positive integer (got ${opts.top})`);
        }
        const minSwitches = Number.parseInt(opts.minSwitches, 10);
        if (!Number.isFinite(minSwitches) || minSwitches < 2) {
          throw new Error(
            `--min-switches must be an integer >= 2 (got ${opts.minSwitches})`,
          );
        }

        const sessions = await readSessionQueueRaw(paths);
        const report = buildModelSwitching(sessions, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          by: opts.by as ModelSwitchingDimension,
          top,
          minSwitches,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderModelSwitching(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('idle-gaps')
  .description('Distribution of intra-session idle gaps between consecutive snapshots')
  .option('--since <iso>', 'inclusive ISO lower bound on started_at')
  .option('--until <iso>', 'exclusive ISO upper bound on started_at')
  .option('--by <dim>', "split dimension: all | source | kind (default 'all')", 'all')
  .option('--min-gap-seconds <n>', 'drop intra-session gaps shorter than n seconds (default 0)', '0')
  .option(
    '--edges <list>',
    `comma-separated bin upper-edges in seconds, strictly ascending (default ${DEFAULT_IDLE_GAP_EDGES_SECONDS.join(',')})`,
  )
  .option(
    '--top-sessions <n>',
    'also emit the top-N session_keys ranked by max intra-session gap (default 0 = skip)',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        by: string;
        minGapSeconds: string;
        edges?: string;
        topSessions: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        if (opts.by !== 'all' && opts.by !== 'source' && opts.by !== 'kind') {
          throw new Error(`--by must be 'all' | 'source' | 'kind' (got ${opts.by})`);
        }
        const minGapSeconds = Number.parseFloat(opts.minGapSeconds);
        if (!Number.isFinite(minGapSeconds) || minGapSeconds < 0) {
          throw new Error(
            `--min-gap-seconds must be a non-negative finite number (got ${opts.minGapSeconds})`,
          );
        }
        const topSessions = Number.parseInt(opts.topSessions, 10);
        if (!Number.isFinite(topSessions) || topSessions < 0) {
          throw new Error(
            `--top-sessions must be a non-negative integer (got ${opts.topSessions})`,
          );
        }
        let edges: number[] | undefined;
        if (opts.edges != null && opts.edges.trim().length > 0) {
          edges = opts.edges.split(',').map((s) => {
            const v = Number.parseFloat(s.trim());
            if (!Number.isFinite(v) || v <= 0) {
              throw new Error(`--edges entries must be positive finite numbers (got '${s}')`);
            }
            return v;
          });
        }

        const sessions = await readSessionQueueRaw(paths);
        const report = buildIdleGaps(sessions, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          by: opts.by as IdleGapsDimension,
          minGapSeconds,
          edges,
          topSessions,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderIdleGaps(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('session-source-mix')
  .description('Share of sessions per source over time buckets (day | week | month)')
  .option('--since <iso>', 'inclusive ISO lower bound on started_at')
  .option('--until <iso>', 'exclusive ISO upper bound on started_at')
  .option('--unit <u>', "bucket granularity: day | week | month (default 'day')", 'day')
  .option(
    '--top <n>',
    "keep only the top-N sources by total sessions in window; fold the rest into 'other' (default 0 = no folding)",
    '0',
  )
  .option(
    '--exclude-source <list>',
    'comma-separated source names to drop *before* bucketing (e.g. synthetic,health-check)',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        unit: string;
        top: string;
        excludeSource?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        if (opts.unit !== 'day' && opts.unit !== 'week' && opts.unit !== 'month') {
          throw new Error(`--unit must be 'day' | 'week' | 'month' (got ${opts.unit})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isFinite(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        let excludeSources: string[] | undefined;
        if (opts.excludeSource != null && opts.excludeSource.trim().length > 0) {
          excludeSources = opts.excludeSource
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          if (excludeSources.length === 0) {
            throw new Error('--exclude-source must contain at least one non-empty entry');
          }
        }

        const sessions = await readSessionQueue(paths);
        const report = buildSourceMix(sessions, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          unit: opts.unit as SourceMixBucketUnit,
          top,
          excludeSources,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceMix(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('provider-share')
  .description('Per-session model-provider mix (anthropic / openai / google / ...) by sessions and by message volume')
  .option('--since <iso>', 'inclusive ISO lower bound on started_at')
  .option('--until <iso>', 'exclusive ISO upper bound on started_at')
  .option('--top-models <n>', 'top distinct models reported per provider (default 3, 0 disables)', '3')
  .option(
    '--min-sessions <n>',
    'hide providers with fewer than n sessions; their counts are surfaced as droppedProviders* but not in the table (default 0)',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: { since?: string; until?: string; topModels: string; minSessions: string; json?: boolean },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const topModels = Number.parseInt(opts.topModels, 10);
        if (!Number.isInteger(topModels) || topModels < 0) {
          throw new Error(`--top-models must be a non-negative integer (got ${opts.topModels})`);
        }
        const minSessions = Number.parseInt(opts.minSessions, 10);
        if (!Number.isInteger(minSessions) || minSessions < 0) {
          throw new Error(`--min-sessions must be a non-negative integer (got ${opts.minSessions})`);
        }

        const sessions = await readSessionQueue(paths);
        const report = buildProviderShare(sessions, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          topModels,
          minSessions,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderProviderShare(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('time-of-day')
  .description('Distribution of session start times across the 24 hours of the day')
  .option('--since <iso>', 'inclusive ISO lower bound on started_at')
  .option('--until <iso>', 'exclusive ISO upper bound on started_at')
  .option(
    '--tz-offset <offset>',
    'timezone offset for hour bucketing (e.g. -07:00, +08:00, Z). default Z (UTC)',
    'Z',
  )
  .option('--by-source', 'also break down each hour by session source (producer CLI)')
  .option(
    '--collapse <n>',
    'collapse adjacent hours into n-sized bins; n must divide 24 (default 1)',
    '1',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        tzOffset: string;
        bySource?: boolean;
        collapse: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const collapse = Number.parseInt(opts.collapse, 10);
        if (!Number.isInteger(collapse) || collapse < 1 || collapse > 24 || 24 % collapse !== 0) {
          throw new Error(
            `--collapse must be a positive divisor of 24 (1, 2, 3, 4, 6, 8, 12, 24); got ${opts.collapse}`,
          );
        }

        const sessions = await readSessionQueue(paths);
        const report = buildTimeOfDay(sessions, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          tzOffset: opts.tzOffset,
          bySource: opts.bySource === true,
          collapse,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderTimeOfDay(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('cache-hit-ratio')
  .description('Per-model prompt-cache hit ratio (cached_input_tokens / input_tokens) across queue.jsonl')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--min-rows <n>',
    'hide models with fewer than n rows; their counts surface as droppedModelRows but not in the table (default 0)',
    '0',
  )
  .option('--by-source', 'also break down each model row by source (producer CLI)')
  .option(
    '--top <n>',
    'show only the top n models by input volume; remainder surface as droppedTopModels (default 0 = no cap)',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: { since?: string; until?: string; minRows: string; bySource?: boolean; top: string; json?: boolean },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 0) {
          throw new Error(`--min-rows must be a non-negative integer (got ${opts.minRows})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const queue = await readQueue(paths);
        const report = buildCacheHitRatio(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minRows,
          bySource: opts.bySource === true,
          top,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderCacheHitRatio(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('reasoning-share')
  .description('Per-model token-weighted share of reasoning_output_tokens / (output + reasoning) across queue.jsonl')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--min-rows <n>',
    'hide models with fewer than n rows; their counts surface as droppedModelRows but not in the table (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n models by generated volume; remainder surface as droppedTopModels (default 0 = no cap)',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: { since?: string; until?: string; minRows: string; top: string; json?: boolean },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 0) {
          throw new Error(`--min-rows must be a non-negative integer (got ${opts.minRows})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const queue = await readQueue(paths);
        const report = buildReasoningShare(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minRows,
          top,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderReasoningShare(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('prompt-size')
  .description('Per-model distribution of input_tokens per row across queue.jsonl (context-window pressure)')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--min-rows <n>',
    'hide models with fewer than n rows; their counts surface as droppedModelRows but not in the table (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n models by row count; remainder surface as droppedTopModels (default 0 = no cap)',
    '0',
  )
  .option(
    '--at-least <n>',
    'drop rows whose input_tokens < n BEFORE bucketing/mean/p95; lets you scope to long-context workloads only (default 0 = no floor)',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: { since?: string; until?: string; minRows: string; top: string; atLeast: string; json?: boolean },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 0) {
          throw new Error(`--min-rows must be a non-negative integer (got ${opts.minRows})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const atLeast = Number.parseInt(opts.atLeast, 10);
        if (!Number.isFinite(atLeast) || atLeast < 0) {
          throw new Error(`--at-least must be a non-negative integer (got ${opts.atLeast})`);
        }
        const queue = await readQueue(paths);
        const report = buildPromptSize(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minRows,
          top,
          atLeast,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderPromptSize(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('output-size')
  .description('Per-model distribution of output_tokens per row across queue.jsonl (completion size, latency / cost geometry)')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--min-rows <n>',
    'hide models with fewer than n rows; their counts surface as droppedModelRows but not in the table (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n models by row count; remainder surface as droppedTopModels (default 0 = no cap)',
    '0',
  )
  .option(
    '--at-least <n>',
    'drop rows whose output_tokens < n BEFORE bucketing/mean/p95; lets you scope to heavy-completion workloads only (default 0 = no floor)',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .option(
    '--by <dim>',
    'group rows by model | source (default model). Source-grouping answers "which CLI is generating the long-completion mass?"',
    'model',
  )
  .action(
    async (
      opts: { since?: string; until?: string; minRows: string; top: string; atLeast: string; by: string; json?: boolean },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 0) {
          throw new Error(`--min-rows must be a non-negative integer (got ${opts.minRows})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const atLeast = Number.parseInt(opts.atLeast, 10);
        if (!Number.isFinite(atLeast) || atLeast < 0) {
          throw new Error(`--at-least must be a non-negative integer (got ${opts.atLeast})`);
        }
        if (opts.by !== 'model' && opts.by !== 'source') {
          throw new Error(`--by must be 'model' or 'source' (got ${opts.by})`);
        }
        const queue = await readQueue(paths);
        const report = buildOutputSize(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minRows,
          top,
          atLeast,
          by: opts.by as 'model' | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderOutputSize(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('peak-hour-share')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--by <dim>',
    'group rows by model | source (default model). Source-grouping answers "which CLI is bursty?"',
    'model',
  )
  .option(
    '--min-days <n>',
    'hide groups with fewer than n contributing days; their counts surface as droppedGroupRows (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n groups by day count; remainder surface as droppedTopGroups (default 0 = no cap)',
    '0',
  )
  .option(
    '--min-active-hours <n>',
    'drop (group, day) pairs with fewer than n distinct active hours BEFORE peak-share is recorded; default 1 keeps singleton-hour days at 100%',
    '1',
  )
  .option(
    '--peak-window <k>',
    'width of the peak window in hours, in [1, 24] (default 1 = busiest single hour). Sums the K highest-token hours per day before dividing by the day total — answers "what fraction of the day landed in my busiest K hours?"',
    '1',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        by: string;
        minDays: string;
        top: string;
        minActiveHours: string;
        peakWindow: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minDays = Number.parseInt(opts.minDays, 10);
        if (!Number.isInteger(minDays) || minDays < 0) {
          throw new Error(`--min-days must be a non-negative integer (got ${opts.minDays})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const minActiveHours = Number.parseInt(opts.minActiveHours, 10);
        if (!Number.isInteger(minActiveHours) || minActiveHours < 1 || minActiveHours > 24) {
          throw new Error(
            `--min-active-hours must be an integer in [1, 24] (got ${opts.minActiveHours})`,
          );
        }
        const peakWindow = Number.parseInt(opts.peakWindow, 10);
        if (!Number.isInteger(peakWindow) || peakWindow < 1 || peakWindow > 24) {
          throw new Error(
            `--peak-window must be an integer in [1, 24] (got ${opts.peakWindow})`,
          );
        }
        if (opts.by !== 'model' && opts.by !== 'source') {
          throw new Error(`--by must be 'model' or 'source' (got ${opts.by})`);
        }
        const queue = await readQueue(paths);
        const report = buildPeakHourShare(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          by: opts.by as 'model' | 'source',
          minDays,
          top,
          minActiveHours,
          peakWindowHours: peakWindow,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderPeakHourShare(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('weekday-share')
  .description('Per-model token mass distribution across ISO weekdays (Mon..Sun, UTC) with HHI concentration')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--by <dim>',
    'group rows by model | source (default model)',
    'model',
  )
  .option(
    '--min-tokens <n>',
    'hide groups with fewer than n total tokens; their counts surface as droppedGroupRows (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n groups by total tokens; remainder surface as droppedTopGroups (default 0 = no cap)',
    '0',
  )
  .option(
    '--min-active-weekdays <n>',
    'hide groups whose activeWeekdays count is < n; their counts surface as droppedSparseGroups. Default 1 keeps every group with any activity. Bump to 5 to hide single-weekday models that trivially score HHI = 1.0',
    '1',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        by: string;
        minTokens: string;
        top: string;
        minActiveWeekdays: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minTokens = Number.parseInt(opts.minTokens, 10);
        if (!Number.isInteger(minTokens) || minTokens < 0) {
          throw new Error(`--min-tokens must be a non-negative integer (got ${opts.minTokens})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const minActiveWeekdays = Number.parseInt(opts.minActiveWeekdays, 10);
        if (
          !Number.isInteger(minActiveWeekdays) ||
          minActiveWeekdays < 1 ||
          minActiveWeekdays > 7
        ) {
          throw new Error(
            `--min-active-weekdays must be an integer in [1, 7] (got ${opts.minActiveWeekdays})`,
          );
        }
        if (opts.by !== 'model' && opts.by !== 'source') {
          throw new Error(`--by must be 'model' or 'source' (got ${opts.by})`);
        }
        const queue = await readQueue(paths);
        const report = buildWeekdayShare(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          by: opts.by as 'model' | 'source',
          minTokens,
          top,
          minActiveWeekdays,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderWeekdayShare(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('burstiness')
  .description('Per-model coefficient-of-variation of hourly token usage (cv = stddev/mean over active hour buckets)')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--by <dim>',
    'group rows by model | source (default model)',
    'model',
  )
  .option(
    '--min-tokens <n>',
    'hide groups with fewer than n total tokens; their counts surface as droppedGroupRows (default 0)',
    '0',
  )
  .option(
    '--min-active-hours <n>',
    'hide groups with fewer than n distinct active hour buckets; their counts surface as droppedSparseGroups (default 1)',
    '1',
  )
  .option(
    '--min-cv <x>',
    'hide groups whose coefficient of variation is < x; their counts surface as droppedLowCvGroups. Default 0 keeps every group. Bump to 1.0 to keep only clearly bursty groups (stddev >= mean)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n groups by total tokens; remainder surface as droppedTopGroups (default 0 = no cap)',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        by: string;
        minTokens: string;
        minActiveHours: string;
        minCv: string;
        top: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minTokens = Number.parseInt(opts.minTokens, 10);
        if (!Number.isInteger(minTokens) || minTokens < 0) {
          throw new Error(`--min-tokens must be a non-negative integer (got ${opts.minTokens})`);
        }
        const minActiveHours = Number.parseInt(opts.minActiveHours, 10);
        if (!Number.isInteger(minActiveHours) || minActiveHours < 1) {
          throw new Error(
            `--min-active-hours must be a positive integer (got ${opts.minActiveHours})`,
          );
        }
        const minCv = Number.parseFloat(opts.minCv);
        if (!Number.isFinite(minCv) || minCv < 0) {
          throw new Error(`--min-cv must be a non-negative number (got ${opts.minCv})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        if (opts.by !== 'model' && opts.by !== 'source') {
          throw new Error(`--by must be 'model' or 'source' (got ${opts.by})`);
        }
        const queue = await readQueue(paths);
        const report = buildBurstiness(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          by: opts.by as 'model' | 'source',
          minTokens,
          minActiveHours,
          minCv,
          top,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderBurstiness(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('device-share')
  .description('Per-device_id share of token mass with model/source/cache breakdown')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--min-tokens <n>',
    'hide devices with fewer than n total tokens; their counts surface as droppedMinTokens (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n devices by total tokens; remainder surface as droppedTopDevices (default 0 = no cap)',
    '0',
  )
  .option(
    '--redact',
    'replace each device_id with a stable short label (dev-XXXXXXXX, sha256/8) for shareable output',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        minTokens: string;
        top: string;
        redact?: boolean;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minTokens = Number.parseInt(opts.minTokens, 10);
        if (!Number.isInteger(minTokens) || minTokens < 0) {
          throw new Error(`--min-tokens must be a non-negative integer (got ${opts.minTokens})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const queue = await readQueue(paths);
        const report = buildDeviceShare(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minTokens,
          top,
          redact: opts.redact ?? false,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderDeviceShare(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('output-input-ratio')
  .description('Per-model output/input token ratio (chatty vs terse) over a window')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--min-rows <n>',
    'hide models with fewer than n considered rows; their counts surface as droppedModelRows (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n models by input volume; remainder surface as droppedTopModels (default 0 = no cap)',
    '0',
  )
  .option(
    '--by-source',
    'also break down each per-model row by source (the local producer CLI); display only, global ratios unchanged',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        minRows: string;
        top: string;
        bySource?: boolean;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 0) {
          throw new Error(`--min-rows must be a non-negative integer (got ${opts.minRows})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const queue = await readQueue(paths);
        const report = buildOutputInputRatio(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minRows,
          top,
          bySource: opts.bySource ?? false,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderOutputInputRatio(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('model-mix-entropy')
  .description('Per-source Shannon entropy of model usage (mono- vs poly-model producers)')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--min-tokens <n>',
    'hide sources with fewer than n total tokens; their counts surface as droppedMinTokens (default 0)',
    '0',
  )
  .option(
    '--top-k <n>',
    'also list the top k models per source (display only; entropy figures unchanged) (default 0 = no breakdown)',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: { since?: string; until?: string; minTokens: string; topK: string; json?: boolean },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minTokens = Number.parseInt(opts.minTokens, 10);
        if (!Number.isFinite(minTokens) || minTokens < 0) {
          throw new Error(`--min-tokens must be a non-negative integer (got ${opts.minTokens})`);
        }
        const topK = Number.parseInt(opts.topK, 10);
        if (!Number.isInteger(topK) || topK < 0) {
          throw new Error(`--top-k must be a non-negative integer (got ${opts.topK})`);
        }
        const queue = await readQueue(paths);
        const report = buildModelMixEntropy(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minTokens,
          topK,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderModelMixEntropy(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('weekend-vs-weekday')
  .description('Per-model weekend (Sat/Sun UTC) vs weekday token mass split with ratio')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--min-rows <n>',
    'hide models with fewer than n considered rows (weekend+weekday); counts surface as droppedMinRows (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n models by total tokens; remainder surface as droppedTopModels (default 0 = no cap)',
    '0',
  )
  .option(
    '--by-source',
    'also break down each kept model row by source (display only; top-level numbers unchanged)',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: { since?: string; until?: string; minRows: string; top: string; bySource?: boolean; json?: boolean },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 0) {
          throw new Error(`--min-rows must be a non-negative integer (got ${opts.minRows})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const queue = await readQueue(paths);
        const report = buildWeekendVsWeekday(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minRows,
          top,
          bySource: opts.bySource ?? false,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderWeekendVsWeekday(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('cache-hit-by-hour')
  .description('Prompt-cache effectiveness (cached/input ratio) bucketed by hour-of-day (UTC), per source')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--min-input <n>',
    'hide sources whose total input_tokens is below n (display only; counts surface as droppedMinInputTokens) (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n sources by input tokens; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .option('--source <name>', 'restrict to a single source (e.g. "codex"); totals and byHour reflect only that source')
  .action(
    async (
      opts: { since?: string; until?: string; minInput: string; top: string; source?: string; json?: boolean },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minInput = Number.parseFloat(opts.minInput);
        if (!Number.isFinite(minInput) || minInput < 0) {
          throw new Error(`--min-input must be a non-negative number (got ${opts.minInput})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const queue = await readQueue(paths);
        const report = buildCacheHitByHour(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minInputTokens: minInput,
          topSources: top,
          source: opts.source ?? null,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderCacheHitByHour(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('model-cohabitation')
  .description('Pairs of models that share the same UTC hour bucket; cohabIndex = Jaccard on bucket presence')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--min-co-buckets <n>',
    'hide pairs with fewer than n shared buckets; counts surface as droppedMinCoBuckets (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n pairs by coBuckets; remainder surface as droppedTopPairs (default 0 = no cap)',
    '0',
  )
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option('--by-model <name>', 'restrict pair report to pairs that include this model (post-normalisation); display only')
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        minCoBuckets: string;
        top: string;
        source?: string;
        byModel?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minCoBuckets = Number.parseInt(opts.minCoBuckets, 10);
        if (!Number.isInteger(minCoBuckets) || minCoBuckets < 0) {
          throw new Error(`--min-co-buckets must be a non-negative integer (got ${opts.minCoBuckets})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const queue = await readQueue(paths);
        const report = buildModelCohabitation(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minCoBuckets,
          top,
          source: opts.source ?? null,
          byModel: opts.byModel ?? null,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderModelCohabitation(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('interarrival-time')
  .description('Per-source distribution of gaps (hours) between consecutive distinct UTC hour buckets with positive token mass')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--top <n>',
    'show only the top n sources after sorting; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--min-active-buckets <n>',
    'hide sources with fewer than n active hour buckets; counts surface as droppedMinActiveBuckets (default 0)',
    '0',
  )
  .option(
    '--sort <key>',
    "sort key for sources[]: 'buckets' (default) | 'gaps' | 'p90'",
    'buckets',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        top: string;
        minActiveBuckets: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const minActiveBuckets = Number.parseInt(opts.minActiveBuckets, 10);
        if (!Number.isInteger(minActiveBuckets) || minActiveBuckets < 0) {
          throw new Error(`--min-active-buckets must be a non-negative integer (got ${opts.minActiveBuckets})`);
        }
        if (opts.sort !== 'buckets' && opts.sort !== 'gaps' && opts.sort !== 'p90') {
          throw new Error(`--sort must be 'buckets' | 'gaps' | 'p90' (got ${opts.sort})`);
        }
        const queue = await readQueue(paths);
        const report = buildInterarrivalTime(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          top,
          minActiveBuckets,
          sort: opts.sort as 'buckets' | 'gaps' | 'p90',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderInterarrivalTime(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('bucket-intensity')
  .description('Per-model distribution of total_tokens per UTC hour bucket; percentiles + magnitude histogram')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--min-buckets <n>',
    'hide model rows with fewer than n active buckets; counts surface as droppedMinBuckets (default 0)',
    '0',
  )
  .option(
    '--bucket-tokens-min <n>',
    'noise-floor: drop individual (model, hour) buckets whose summed total_tokens < n; counts surface as droppedBucketTokensMin (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n models after sorting; remainder surface as droppedTopModels (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    "sort key for models[]: 'tokens' (default) | 'buckets' | 'p99' | 'spread'",
    'tokens',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minBuckets: string;
        bucketTokensMin: string;
        top: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minBuckets = Number.parseInt(opts.minBuckets, 10);
        if (!Number.isInteger(minBuckets) || minBuckets < 0) {
          throw new Error(`--min-buckets must be a non-negative integer (got ${opts.minBuckets})`);
        }
        const bucketTokensMin = Number.parseInt(opts.bucketTokensMin, 10);
        if (!Number.isInteger(bucketTokensMin) || bucketTokensMin < 0) {
          throw new Error(
            `--bucket-tokens-min must be a non-negative integer (got ${opts.bucketTokensMin})`,
          );
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        if (
          opts.sort !== 'tokens' &&
          opts.sort !== 'buckets' &&
          opts.sort !== 'p99' &&
          opts.sort !== 'spread'
        ) {
          throw new Error(
            `--sort must be 'tokens' | 'buckets' | 'p99' | 'spread' (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildBucketIntensity(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minBuckets,
          bucketTokensMin,
          top,
          sort: opts.sort as 'tokens' | 'buckets' | 'p99' | 'spread',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderBucketIntensity(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('model-tenure')
  .description('Per-model active span: firstSeen, lastSeen, spanHours, activeBuckets, tokens, tokensPerSpanHour')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--top <n>',
    'show only the top n models after sorting; remainder surface as droppedTopModels (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    "sort key for models[]: 'span' (default) | 'active' | 'tokens' | 'density'",
    'span',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        top: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        if (
          opts.sort !== 'span' &&
          opts.sort !== 'active' &&
          opts.sort !== 'tokens' &&
          opts.sort !== 'density'
        ) {
          throw new Error(
            `--sort must be 'span' | 'active' | 'tokens' | 'density' (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildModelTenure(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          top,
          sort: opts.sort as 'span' | 'active' | 'tokens' | 'density',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderModelTenure(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('provider-tenure')
  .description('Per-provider active span: firstSeen, lastSeen, spanHours, activeBuckets, distinctModels, tokens, tokensPerSpanHour (vendor-axis analog of model-tenure)')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--min-buckets <n>',
    'drop providers whose activeBuckets < n; suppressed rows surface as droppedSparseProviders (applied before --top; default 0 = no floor)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n providers after sorting; remainder surface as droppedTopProviders (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    "sort key for providers[]: 'span' (default) | 'active' | 'tokens' | 'density' | 'models'",
    'span',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minBuckets: string;
        top: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minBuckets = Number.parseInt(opts.minBuckets, 10);
        if (!Number.isInteger(minBuckets) || minBuckets < 0) {
          throw new Error(`--min-buckets must be a non-negative integer (got ${opts.minBuckets})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        if (
          opts.sort !== 'span' &&
          opts.sort !== 'active' &&
          opts.sort !== 'tokens' &&
          opts.sort !== 'density' &&
          opts.sort !== 'models'
        ) {
          throw new Error(
            `--sort must be 'span' | 'active' | 'tokens' | 'density' | 'models' (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildProviderTenure(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minBuckets,
          top,
          sort: opts.sort as 'span' | 'active' | 'tokens' | 'density' | 'models',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderProviderTenure(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('first-bucket-of-day')
  .description('Per UTC calendar day, the earliest active hour bucket — wake-up clock lens with min/max/mean/median/p25/p75/mode firstHour stats')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--top <n>',
    'show only the most-recent n days; remainder surface as droppedTopDays. Summary stats always reflect the full population. Default 0 = no cap.',
    '0',
  )
  .option(
    '--sort <key>',
    "sort key for days[]: 'day' (default, desc) | 'first-hour' (asc) | 'tokens' (desc) | 'buckets' (desc)",
    'day',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        top: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        if (
          opts.sort !== 'day' &&
          opts.sort !== 'first-hour' &&
          opts.sort !== 'tokens' &&
          opts.sort !== 'buckets'
        ) {
          throw new Error(
            `--sort must be 'day' | 'first-hour' | 'tokens' | 'buckets' (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildFirstBucketOfDay(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          top,
          sort: opts.sort as 'day' | 'first-hour' | 'tokens' | 'buckets',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderFirstBucketOfDay(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('last-bucket-of-day')
  .description('Per UTC calendar day, the latest active hour bucket — shutdown-clock lens with min/max/mean/median/p25/p75/mode lastHour stats')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--top <n>',
    'cap days[] after sorting; remainder surface as droppedTopDays. Summary stats always reflect the full population. Default 0 = no cap.',
    '0',
  )
  .option(
    '--sort <key>',
    "sort key for days[]: 'day' (default, desc) | 'last-hour' (desc) | 'tokens' (desc) | 'buckets' (desc)",
    'day',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        top: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        if (
          opts.sort !== 'day' &&
          opts.sort !== 'last-hour' &&
          opts.sort !== 'tokens' &&
          opts.sort !== 'buckets'
        ) {
          throw new Error(
            `--sort must be 'day' | 'last-hour' | 'tokens' | 'buckets' (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildLastBucketOfDay(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          top,
          sort: opts.sort as 'day' | 'last-hour' | 'tokens' | 'buckets',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderLastBucketOfDay(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );


program
  .command('output-token-decile-distribution')
  .description('Rank all positive-output buckets ascending and partition into 10 equal-sized deciles; report per-decile mass + Gini + top-10%/top-1% concentration')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--min-output <n>',
    'drop bucket rows whose output_tokens < n before partitioning; suppressed rows surface as droppedBelowMinOutput. Default 0 = no floor.',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minOutput: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minOutput = Number.parseInt(opts.minOutput, 10);
        if (!Number.isInteger(minOutput) || minOutput < 0) {
          throw new Error(`--min-output must be a non-negative integer (got ${opts.minOutput})`);
        }
        const queue = await readQueue(paths);
        const report = buildOutputTokenDecileDistribution(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minOutput,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderOutputTokenDecileDistribution(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );


program
  .command('input-token-decile-distribution')
  .description('Rank all positive-input buckets ascending and partition into 10 equal-sized deciles; report per-decile mass + Gini + top-10%/top-1% concentration on input_tokens (the context/prompt side of cost)')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--min-input <n>',
    'drop bucket rows whose input_tokens < n before partitioning; suppressed rows surface as droppedBelowMinInput. Default 0 = no floor.',
    '0',
  )
  .option(
    '--top <n>',
    'surface the heaviest N individual buckets (with hour_start/source/model/decile) under topBuckets, for D10 outlier drill-down. Default 0 = no top list.',
    '0',
  )
  .option(
    '--bottom <n>',
    'surface the lightest N individual buckets under bottomBuckets, sorted ascending. Default 0 = no bottom list.',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minInput: string;
        top: string;
        bottom: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minInput = Number.parseInt(opts.minInput, 10);
        if (!Number.isInteger(minInput) || minInput < 0) {
          throw new Error(`--min-input must be a non-negative integer (got ${opts.minInput})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const bottom = Number.parseInt(opts.bottom, 10);
        if (!Number.isInteger(bottom) || bottom < 0) {
          throw new Error(`--bottom must be a non-negative integer (got ${opts.bottom})`);
        }
        const queue = await readQueue(paths);
        const report = buildInputTokenDecileDistribution(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minInput,
          top,
          bottom,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderInputTokenDecileDistribution(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );


program
  .command('active-span-per-day')
  .description('Per UTC calendar day, the workday window: firstHour, lastHour, spanHours, activeBuckets, and dutyCycle (= activeBuckets / spanHours)')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--top <n>',
    'cap days[] after sorting; remainder surface as droppedTopDays. Summary stats always reflect the full population. Default 0 = no cap.',
    '0',
  )
  .option(
    '--sort <key>',
    "sort key for days[]: 'day' (default, desc) | 'span' (desc) | 'duty' (desc) | 'tokens' (desc) | 'active' (desc)",
    'day',
  )
  .option(
    '--min-span <n>',
    'drop days whose spanHours < n before computing summary stats; suppressed days surface as droppedShortSpanDays. Default 0 = no floor.',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        top: string;
        sort: string;
        minSpan: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const minSpan = Number.parseInt(opts.minSpan, 10);
        if (!Number.isInteger(minSpan) || minSpan < 0) {
          throw new Error(`--min-span must be a non-negative integer (got ${opts.minSpan})`);
        }
        if (
          opts.sort !== 'day' &&
          opts.sort !== 'span' &&
          opts.sort !== 'duty' &&
          opts.sort !== 'tokens' &&
          opts.sort !== 'active'
        ) {
          throw new Error(
            `--sort must be 'day' | 'span' | 'duty' | 'tokens' | 'active' (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildActiveSpanPerDay(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          top,
          sort: opts.sort as 'day' | 'span' | 'duty' | 'tokens' | 'active',
          minSpan,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderActiveSpanPerDay(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('tail-share')
  .description('Per-source Pareto: fraction of total tokens in the top 1/5/10/20% of buckets, with giniLike concentration scalar')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--min-buckets <n>',
    'drop sources whose bucketCount < n; suppressed rows surface as droppedSparseSources (default 0 = no floor)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sorting by giniLike desc; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        minBuckets: string;
        top: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minBuckets = Number.parseInt(opts.minBuckets, 10);
        if (!Number.isInteger(minBuckets) || minBuckets < 0) {
          throw new Error(`--min-buckets must be a non-negative integer (got ${opts.minBuckets})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const queue = await readQueue(paths);
        const report = buildTailShare(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minBuckets,
          top,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderTailShare(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('tenure-vs-density-quadrant')
  .description('Classify each model into a 2×2 quadrant by (long/short tenure × dense/sparse density), with global medians as splits')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--min-buckets <n>',
    'drop models whose activeBuckets < n before computing medians; suppressed rows surface as droppedSparseModels (default 0 = no floor)',
    '0',
  )
  .option(
    '--top <n>',
    'cap each quadrant\'s displayed model list to the top n rows; remainder surface as droppedTop per quadrant (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    "sort key inside each quadrant's models[]: 'tokens' (default) | 'span' | 'density' | 'active'",
    'tokens',
  )
  .option(
    '--quadrant <q>',
    "restrict the report to a single quadrant: 'long-dense' | 'long-sparse' | 'short-dense' | 'short-sparse' (medians still computed over the full population)",
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minBuckets: string;
        top: string;
        sort: string;
        quadrant?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minBuckets = Number.parseInt(opts.minBuckets, 10);
        if (!Number.isInteger(minBuckets) || minBuckets < 0) {
          throw new Error(`--min-buckets must be a non-negative integer (got ${opts.minBuckets})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        if (
          opts.sort !== 'tokens' &&
          opts.sort !== 'span' &&
          opts.sort !== 'density' &&
          opts.sort !== 'active'
        ) {
          throw new Error(
            `--sort must be 'tokens' | 'span' | 'density' | 'active' (got ${opts.sort})`,
          );
        }
        if (
          opts.quadrant !== undefined &&
          opts.quadrant !== 'long-dense' &&
          opts.quadrant !== 'long-sparse' &&
          opts.quadrant !== 'short-dense' &&
          opts.quadrant !== 'short-sparse'
        ) {
          throw new Error(
            `--quadrant must be 'long-dense' | 'long-sparse' | 'short-dense' | 'short-sparse' (got ${opts.quadrant})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildTenureDensityQuadrant(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minBuckets,
          top,
          sort: opts.sort as 'tokens' | 'span' | 'density' | 'active',
          quadrant: (opts.quadrant ?? null) as
            | 'long-dense'
            | 'long-sparse'
            | 'short-dense'
            | 'short-sparse'
            | null,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderTenureDensityQuadrant(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-tenure')
  .description('Per-source active span: firstSeen, lastSeen, spanHours, activeBuckets, tokens, distinctModels (the source-axis analog of model-tenure)')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--model <name>', 'restrict analysis to a single (normalised) model; non-matching rows surface as droppedModelFilter')
  .option(
    '--min-buckets <n>',
    'drop sources whose activeBuckets < n; suppressed rows surface as droppedSparseSources (default 0 = no floor)',
    '0',
  )
  .option(
    '--min-models <n>',
    'drop sources whose distinctModels < n; suppressed rows surface as droppedNarrowSources (default 0 = no floor)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sorting; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    "sort key for sources[]: 'span' (default) | 'active' | 'tokens' | 'density' | 'models'",
    'span',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        model?: string;
        minBuckets: string;
        minModels: string;
        top: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minBuckets = Number.parseInt(opts.minBuckets, 10);
        if (!Number.isInteger(minBuckets) || minBuckets < 0) {
          throw new Error(`--min-buckets must be a non-negative integer (got ${opts.minBuckets})`);
        }
        const minModels = Number.parseInt(opts.minModels, 10);
        if (!Number.isInteger(minModels) || minModels < 0) {
          throw new Error(`--min-models must be a non-negative integer (got ${opts.minModels})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        if (
          opts.sort !== 'span' &&
          opts.sort !== 'active' &&
          opts.sort !== 'tokens' &&
          opts.sort !== 'density' &&
          opts.sort !== 'models'
        ) {
          throw new Error(
            `--sort must be 'span' | 'active' | 'tokens' | 'density' | 'models' (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceTenure(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          model: opts.model ?? null,
          minBuckets,
          minModels,
          top,
          sort: opts.sort as 'span' | 'active' | 'tokens' | 'density' | 'models',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceTenure(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('bucket-streak-length')
  .description('Per-model longest consecutive-active-bucket runs (sustained vs spiky usage)')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--min-buckets <n>',
    'drop models whose activeBuckets < n; suppressed rows surface as droppedSparseModels (default 0 = no floor)',
    '0',
  )
  .option(
    '--sort <key>',
    "sort key for models[]: 'length' (default) | 'tokens' | 'active' | 'mean'",
    'length',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minBuckets: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minBuckets = Number.parseInt(opts.minBuckets, 10);
        if (!Number.isInteger(minBuckets) || minBuckets < 0) {
          throw new Error(`--min-buckets must be a non-negative integer (got ${opts.minBuckets})`);
        }
        if (
          opts.sort !== 'length' &&
          opts.sort !== 'tokens' &&
          opts.sort !== 'active' &&
          opts.sort !== 'mean'
        ) {
          throw new Error(
            `--sort must be 'length' | 'tokens' | 'active' | 'mean' (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildBucketStreakLength(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minBuckets,
          sort: opts.sort as 'length' | 'tokens' | 'active' | 'mean',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderBucketStreakLength(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('bucket-gap-distribution')
  .description('Per-source distribution of gap sizes (in bucket-widths) between consecutive active buckets')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--model <name>', 'restrict analysis to a single model; non-matching rows surface as droppedModelFilter')
  .option(
    '--min-gaps <n>',
    'drop sources whose gapCount < n; suppressed rows surface as droppedSparseSources (default 0 = no floor; 1 also suppresses single-bucket sources)',
    '0',
  )
  .option(
    '--min-gap <n>',
    'floor on individual gap size in bucket-widths; gaps below n are dropped before percentile/mean/contiguousShare; counts surface as droppedBelowMinGap and droppedAllGapsFloored (default 0 = no per-gap floor; 2 = "ignore contiguous gaps, describe only true idle stretches")',
    '0',
  )
  .option(
    '--top <n>',
    'cap displayed sources to top n after sort and the min-gaps filter; suppressed rows surface as droppedBelowTopCap (default unset = no cap)',
  )
  .option(
    '--sort <key>',
    "sort key for sources[]: 'tokens' (default) | 'gaps' | 'p50' | 'max' | 'contiguous'",
    'tokens',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        model?: string;
        minGaps: string;
        minGap: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minGaps = Number.parseInt(opts.minGaps, 10);
        if (!Number.isInteger(minGaps) || minGaps < 0) {
          throw new Error(`--min-gaps must be a non-negative integer (got ${opts.minGaps})`);
        }
        const minGap = Number.parseInt(opts.minGap, 10);
        if (!Number.isInteger(minGap) || minGap < 0) {
          throw new Error(`--min-gap must be a non-negative integer (got ${opts.minGap})`);
        }
        let top: number | null = null;
        if (opts.top !== undefined) {
          top = Number.parseInt(opts.top, 10);
          if (!Number.isInteger(top) || top < 1) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
        }
        if (
          opts.sort !== 'tokens' &&
          opts.sort !== 'gaps' &&
          opts.sort !== 'p50' &&
          opts.sort !== 'max' &&
          opts.sort !== 'contiguous'
        ) {
          throw new Error(
            `--sort must be 'tokens' | 'gaps' | 'p50' | 'max' | 'contiguous' (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildBucketGapDistribution(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          model: opts.model ?? null,
          minGaps,
          minGap,
          top,
          sort: opts.sort as 'tokens' | 'gaps' | 'p50' | 'max' | 'contiguous',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderBucketGapDistribution(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-decay-half-life')
  .description('Per-source token "half-life" along the tenure axis (front-loaded vs back-loaded usage)')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--model <name>', 'restrict analysis to a single model; non-matching rows surface as droppedModelFilter')
  .option(
    '--min-buckets <n>',
    'drop sources whose activeBuckets < n; suppressed rows surface as droppedSparseSources (default 0 = no floor)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the number of source rows after sort and the min-buckets floor; suppressed rows surface as droppedBelowTopCap (default unset = no cap)',
  )
  .option(
    '--sort <key>',
    "sort key for sources[]: 'halflife' (default) | 'frontload' | 'tokens' | 'span' | 'active'",
    'halflife',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        model?: string;
        minBuckets: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minBuckets = Number.parseInt(opts.minBuckets, 10);
        if (!Number.isInteger(minBuckets) || minBuckets < 0) {
          throw new Error(`--min-buckets must be a non-negative integer (got ${opts.minBuckets})`);
        }
        let top: number | null = null;
        if (opts.top !== undefined) {
          top = Number.parseInt(opts.top, 10);
          if (!Number.isInteger(top) || top < 1) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
        }
        if (
          opts.sort !== 'halflife' &&
          opts.sort !== 'frontload' &&
          opts.sort !== 'tokens' &&
          opts.sort !== 'span' &&
          opts.sort !== 'active'
        ) {
          throw new Error(
            `--sort must be 'halflife' | 'frontload' | 'tokens' | 'span' | 'active' (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceDecayHalfLife(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          model: opts.model ?? null,
          minBuckets,
          top,
          sort: opts.sort as 'halflife' | 'frontload' | 'tokens' | 'span' | 'active',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceDecayHalfLife(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('bucket-handoff-frequency')
  .description('How often the primary model changes between consecutive active hour-buckets in time order')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--top-handoffs <n>',
    'cap the number of (from -> to) handoff pairs in the table (default 10; use 0 to suppress the table)',
    '10',
  )
  .option(
    '--min-handoffs <n>',
    'drop pairs whose count is below n before applying --top-handoffs; suppressed rows surface as droppedBelowMinHandoffs (default 1 = no floor)',
    '1',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        topHandoffs: string;
        minHandoffs: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const topHandoffs = Number.parseInt(opts.topHandoffs, 10);
        if (!Number.isInteger(topHandoffs) || topHandoffs < 0) {
          throw new Error(
            `--top-handoffs must be a non-negative integer (got ${opts.topHandoffs})`,
          );
        }
        const minHandoffs = Number.parseInt(opts.minHandoffs, 10);
        if (!Number.isInteger(minHandoffs) || minHandoffs < 1) {
          throw new Error(
            `--min-handoffs must be a positive integer (got ${opts.minHandoffs})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildBucketHandoffFrequency(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          topHandoffs,
          minHandoffs,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderBucketHandoffFrequency(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('inter-source-handoff-latency')
  .description(
    'Median wall-clock time between adjacent active hour-buckets whose primary source (CLI tool) changed — tool-handoff cadence lens with min/median/mean/max latency, contiguous-vs-gapped split, and top (from -> to) source pairs',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--top-handoffs <n>',
    'cap the number of (from -> to) source-handoff pairs in the table (default 10; use 0 to suppress the table)',
    '10',
  )
  .option(
    '--min-handoffs <n>',
    'drop pairs whose count is below n before applying --top-handoffs; suppressed rows surface as droppedBelowMinHandoffs (default 1 = no floor)',
    '1',
  )
  .option(
    '--max-latency-hours <n>',
    'exclude handoffs whose latency in hours is strictly greater than n from ALL counters and stats (handoffPairs, latency stats, pairs[], contiguous/gapped split). Suppressed handoffs surface as droppedAboveMaxLatency. Default unset = no cap. Use to focus on live in-session swaps (e.g. 4 drops overnight gaps).',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        topHandoffs: string;
        minHandoffs: string;
        maxLatencyHours?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const topHandoffs = Number.parseInt(opts.topHandoffs, 10);
        if (!Number.isInteger(topHandoffs) || topHandoffs < 0) {
          throw new Error(
            `--top-handoffs must be a non-negative integer (got ${opts.topHandoffs})`,
          );
        }
        const minHandoffs = Number.parseInt(opts.minHandoffs, 10);
        if (!Number.isInteger(minHandoffs) || minHandoffs < 1) {
          throw new Error(
            `--min-handoffs must be a positive integer (got ${opts.minHandoffs})`,
          );
        }
        let maxLatencyHours: number | null = null;
        if (opts.maxLatencyHours !== undefined) {
          const v = Number.parseFloat(opts.maxLatencyHours);
          if (!Number.isFinite(v) || v <= 0) {
            throw new Error(
              `--max-latency-hours must be a positive finite number (got ${opts.maxLatencyHours})`,
            );
          }
          maxLatencyHours = v;
        }
        const queue = await readQueue(paths);
        const report = buildInterSourceHandoffLatency(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          topHandoffs,
          minHandoffs,
          maxLatencyHours,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderInterSourceHandoffLatency(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('provider-switching-frequency')
  .description(
    'Per UTC day, how often the primary provider (anthropic / openai / ...) of consecutive active hour-buckets changes — same-day vendor-churn lens with cross-day swap split, top (from -> to) pairs, and per-day rows',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--top-pairs <n>',
    'cap the number of (from -> to) provider-switch pairs in the table (default 10; use 0 to suppress the table)',
    '10',
  )
  .option(
    '--top-days <n>',
    'cap the number of days[] rows after sort; remainder surface as droppedTopDays. Summary stats always reflect the full population. Default 0 = no cap.',
    '0',
  )
  .option(
    '--sort <key>',
    "sort key for days[]: 'day' (default, desc) | 'switches' (desc) | 'buckets' (desc) | 'share' (desc)",
    'day',
  )
  .option(
    '--min-switches <n>',
    'drop days[] rows whose switchPairs count is below n. Display filter only — summary stats still reflect the full population. Suppressed rows surface as droppedBelowMinSwitches. Default 0 = no floor.',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        topPairs: string;
        topDays: string;
        sort: string;
        minSwitches: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const topPairs = Number.parseInt(opts.topPairs, 10);
        if (!Number.isInteger(topPairs) || topPairs < 0) {
          throw new Error(
            `--top-pairs must be a non-negative integer (got ${opts.topPairs})`,
          );
        }
        const topDays = Number.parseInt(opts.topDays, 10);
        if (!Number.isInteger(topDays) || topDays < 0) {
          throw new Error(
            `--top-days must be a non-negative integer (got ${opts.topDays})`,
          );
        }
        const minSwitches = Number.parseInt(opts.minSwitches, 10);
        if (!Number.isInteger(minSwitches) || minSwitches < 0) {
          throw new Error(
            `--min-switches must be a non-negative integer (got ${opts.minSwitches})`,
          );
        }
        if (
          opts.sort !== 'day' &&
          opts.sort !== 'switches' &&
          opts.sort !== 'buckets' &&
          opts.sort !== 'share'
        ) {
          throw new Error(
            `--sort must be 'day' | 'switches' | 'buckets' | 'share' (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildProviderSwitchingFrequency(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          topPairs,
          topDays,
          sort: opts.sort as 'day' | 'switches' | 'buckets' | 'share',
          minSwitches,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderProviderSwitchingFrequency(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-breadth-per-day')
  .description('Per UTC calendar day, count of distinct active sources — tool-diversity lens with min/p25/median/mean/p75/max sourceCount stats and single/multi-source day split')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter (degenerates sourceCount to 1)')
  .option(
    '--top <n>',
    'cap days[] after sorting; remainder surface as droppedTopDays. Summary stats always reflect the full population. Default 0 = no cap.',
    '0',
  )
  .option(
    '--sort <key>',
    "sort key for days[]: 'day' (default, desc) | 'sources' (desc) | 'tokens' (desc) | 'buckets' (desc)",
    'day',
  )
  .option(
    '--min-sources <n>',
    'drop days whose sourceCount < n before computing summary stats AND days[]; suppressed days surface as droppedBelowMinSources. Default 0 = no floor.',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        top: string;
        sort: string;
        minSources: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const minSources = Number.parseInt(opts.minSources, 10);
        if (!Number.isInteger(minSources) || minSources < 0) {
          throw new Error(`--min-sources must be a non-negative integer (got ${opts.minSources})`);
        }
        if (
          opts.sort !== 'day' &&
          opts.sort !== 'sources' &&
          opts.sort !== 'tokens' &&
          opts.sort !== 'buckets'
        ) {
          throw new Error(
            `--sort must be 'day' | 'sources' | 'tokens' | 'buckets' (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceBreadthPerDay(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          top,
          sort: opts.sort as 'day' | 'sources' | 'tokens' | 'buckets',
          minSources,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceBreadthPerDay(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('bucket-density-percentile')
  .description('Population-level distribution of total_tokens per bucket pooled across all rows: full percentile ladder (p1..p99.9, max) plus 10-decile mass shares (D1=smallest, D10=top 10%)')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--min-tokens <n>',
    'drop buckets whose total_tokens < n before percentile and decile computation; suppressed buckets surface as droppedBelowMinTokens. Default 0 = no floor.',
    '0',
  )
  .option(
    '--trim-top <pct>',
    'outlier-trim: drop the top P percent of buckets (by token mass) before percentile and decile computation; suppressed buckets surface as droppedTrimTop. Range [0, 100). Default 0 = no trim.',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minTokens: string;
        trimTop: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minTokens = Number.parseInt(opts.minTokens, 10);
        if (!Number.isInteger(minTokens) || minTokens < 0) {
          throw new Error(`--min-tokens must be a non-negative integer (got ${opts.minTokens})`);
        }
        const trimTopPct = Number.parseFloat(opts.trimTop);
        if (!Number.isFinite(trimTopPct) || trimTopPct < 0 || trimTopPct >= 100) {
          throw new Error(`--trim-top must be a finite number in [0, 100) (got ${opts.trimTop})`);
        }
        const queue = await readQueue(paths);
        const report = buildBucketDensityPercentile(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minTokens,
          trimTopPct,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderBucketDensityPercentile(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('hour-of-week')
  .description('168-cell joint (weekday × hour-of-day, UTC) concentration lens: Shannon entropy in bits, normalised entropy, Gini, top-K mass share, populated vs dead cells, and top cells by token mass')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option('--model <name>', 'restrict analysis to a single normalised model; non-matching rows surface as droppedModelFilter')
  .option('--top <n>', 'truncate topCells[] to the top N by tokens desc; concentration metrics always reflect the full 168-cell population. Default 10.', '10')
  .option('--top-k <n>', 'mass-share concentration window: report tokenShare of the top K cells. Range [1, 168]. Default 10.', '10')
  .option(
    '--min-cell-tokens <n>',
    'drop cells whose total_tokens < n from topCells[]; suppressed cells surface as droppedSparseCells. Display filter only — entropy / gini / topKShare always reflect the full 168-cell population. Default 0 = no floor.',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        model?: string;
        top: string;
        topK: string;
        minCellTokens: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 1) {
          throw new Error(`--top must be a positive integer (got ${opts.top})`);
        }
        const topK = Number.parseInt(opts.topK, 10);
        if (!Number.isInteger(topK) || topK < 1 || topK > 168) {
          throw new Error(`--top-k must be an integer in [1, 168] (got ${opts.topK})`);
        }
        const minCellTokens = Number.parseInt(opts.minCellTokens, 10);
        if (!Number.isInteger(minCellTokens) || minCellTokens < 0) {
          throw new Error(`--min-cell-tokens must be a non-negative integer (got ${opts.minCellTokens})`);
        }
        const queue = await readQueue(paths);
        const report = buildHourOfWeek(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          model: opts.model ?? null,
          top,
          topK,
          minCellTokens,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderHourOfWeek(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('device-tenure')
  .description('Per-device active-span lens: firstSeen / lastSeen / spanHours / activeBuckets / tokens / density / distinctSources / distinctModels — completes the tenure family on the device_id axis')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict to a single source; non-matching rows surface as droppedSourceFilter')
  .option('--model <name>', 'restrict to a single normalised model; non-matching rows surface as droppedModelFilter')
  .option('--min-buckets <n>', 'drop devices with activeBuckets < n from devices[]; counts surface as droppedSparseDevices. Default 0 = keep every device.', '0')
  .option('--top <n>', 'truncate devices[] to the top N after sort; 0 = no cap. Default 0.', '0')
  .option('--sort <key>', 'sort key: span | active | tokens | density | sources | models | gap. Default span.', 'span')
  .option('--recent-threshold-hours <h>', 'hours threshold for the recentlyActive flag. Default 24.', '24')
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        model?: string;
        minBuckets: string;
        top: string;
        sort: string;
        recentThresholdHours: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minBuckets = Number.parseInt(opts.minBuckets, 10);
        if (!Number.isInteger(minBuckets) || minBuckets < 0) {
          throw new Error(`--min-buckets must be a non-negative integer (got ${opts.minBuckets})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const sort = opts.sort;
        if (
          sort !== 'span' &&
          sort !== 'active' &&
          sort !== 'tokens' &&
          sort !== 'density' &&
          sort !== 'sources' &&
          sort !== 'models' &&
          sort !== 'gap'
        ) {
          throw new Error(`--sort must be one of span | active | tokens | density | sources | models | gap (got ${opts.sort})`);
        }
        const recentThresholdHours = Number(opts.recentThresholdHours);
        if (!Number.isFinite(recentThresholdHours) || recentThresholdHours <= 0) {
          throw new Error(`--recent-threshold-hours must be > 0 (got ${opts.recentThresholdHours})`);
        }
        const queue = await readQueue(paths);
        const report = buildDeviceTenure(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          model: opts.model ?? null,
          minBuckets,
          top,
          sort,
          recentThresholdHours,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderDeviceTenure(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('prompt-output-correlation')
  .description(
    'Per-group Pearson correlation between hourly prompt-token mass and output-token mass (with OLS slope/intercept)',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--by <dim>',
    'group rows by model | source (default model)',
    'model',
  )
  .option(
    '--min-buckets <n>',
    'hide groups with fewer than n active hour buckets; their counts surface as droppedSparseGroups (default 2 — Pearson r needs >= 2 points)',
    '2',
  )
  .option(
    '--min-tokens <n>',
    'hide groups whose totalTokens is < n; their counts surface as droppedLowTokenGroups (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n groups by sort key; remainder surface as droppedTopGroups (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    'sort by tokens|r|abs-r|buckets|slope (default tokens, all desc with lex tiebreak on group)',
    'tokens',
  )
  .option(
    '--source <name>',
    'only include rows whose source matches exactly (narrows global denominators too)',
  )
  .option(
    '--model <name>',
    'only include rows whose model matches (post-normaliseModel; narrows global denominators too)',
  )
  .option(
    '--include-reasoning',
    'add reasoning_output_tokens to the y-axis so the correlation describes total reply work, not just visible output (default false)',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        by: string;
        minBuckets: string;
        minTokens: string;
        top: string;
        sort: string;
        source?: string;
        model?: string;
        includeReasoning?: boolean;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minBuckets = Number.parseInt(opts.minBuckets, 10);
        if (!Number.isInteger(minBuckets) || minBuckets < 1) {
          throw new Error(
            `--min-buckets must be a positive integer (got ${opts.minBuckets})`,
          );
        }
        const minTokens = Number.parseInt(opts.minTokens, 10);
        if (!Number.isInteger(minTokens) || minTokens < 0) {
          throw new Error(
            `--min-tokens must be a non-negative integer (got ${opts.minTokens})`,
          );
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        if (opts.by !== 'model' && opts.by !== 'source') {
          throw new Error(`--by must be 'model' or 'source' (got ${opts.by})`);
        }
        const sort = opts.sort;
        if (
          sort !== 'tokens' &&
          sort !== 'r' &&
          sort !== 'abs-r' &&
          sort !== 'buckets' &&
          sort !== 'slope'
        ) {
          throw new Error(
            `--sort must be one of tokens|r|abs-r|buckets|slope (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildPromptOutputCorrelation(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          by: opts.by as 'model' | 'source',
          minBuckets,
          minTokens,
          top,
          sort,
          source: opts.source ?? null,
          model: opts.model ?? null,
          includeReasoning: opts.includeReasoning === true,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderPromptOutputCorrelation(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-pair-cooccurrence')
  .description(
    'Unordered pairs of sources (CLI tools) that are co-active in the same hour-bucket — multi-tool concurrency lens with raw count, share-of-pairs, and Jaccard similarity per pair, plus a multi-source-bucket share',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--top-pairs <n>',
    'cap the number of {a,b} co-occurrence pairs in the table (default 10; use 0 to suppress the table)',
    '10',
  )
  .option(
    '--min-count <n>',
    'drop pairs whose count is below n before applying --top-pairs; suppressed rows surface as droppedBelowMinCount (default 1 = no floor)',
    '1',
  )
  .option(
    '--min-jaccard <n>',
    'drop pairs whose jaccard is below n (in [0,1]); applied after --min-count and before --top-pairs. Suppressed rows surface as droppedBelowMinJaccard. Use to filter out high-count low-jaccard "noise" pairs (a tool that runs everywhere and incidentally overlaps with everything). Default 0 = no floor.',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        topPairs: string;
        minCount: string;
        minJaccard: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const topPairs = Number.parseInt(opts.topPairs, 10);
        if (!Number.isInteger(topPairs) || topPairs < 0) {
          throw new Error(
            `--top-pairs must be a non-negative integer (got ${opts.topPairs})`,
          );
        }
        const minCount = Number.parseInt(opts.minCount, 10);
        if (!Number.isInteger(minCount) || minCount < 1) {
          throw new Error(
            `--min-count must be a positive integer (got ${opts.minCount})`,
          );
        }
        const minJaccard = Number.parseFloat(opts.minJaccard);
        if (!Number.isFinite(minJaccard) || minJaccard < 0 || minJaccard > 1) {
          throw new Error(
            `--min-jaccard must be a finite number in [0, 1] (got ${opts.minJaccard})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourcePairCooccurrence(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          topPairs,
          minCount,
          minJaccard,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourcePairCooccurrence(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('token-velocity-percentiles')
  .description(
    'Per-source distribution of tokens-per-minute computed at the single UTC hour bucket grain (rate = total_tokens / 60); percentiles p50/p90/p99 plus min/max/mean per source',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--min-buckets <n>',
    'hide source rows with fewer than n active buckets; counts surface as droppedMinBuckets (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sorting; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--rate-min <n>',
    'noise-floor: drop individual (source, hour) buckets whose tokens-per-minute rate is < n; counts surface as droppedRateMin (default 0)',
    '0',
  )
  .option(
    '--sort <key>',
    "sort key for sources[]: 'tokens' (default) | 'buckets' | 'p99' | 'mean'",
    'tokens',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minBuckets: string;
        top: string;
        rateMin: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minBuckets = Number.parseInt(opts.minBuckets, 10);
        if (!Number.isInteger(minBuckets) || minBuckets < 0) {
          throw new Error(`--min-buckets must be a non-negative integer (got ${opts.minBuckets})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const rateMin = Number.parseFloat(opts.rateMin);
        if (!Number.isFinite(rateMin) || rateMin < 0) {
          throw new Error(`--rate-min must be a non-negative finite number (got ${opts.rateMin})`);
        }
        if (
          opts.sort !== 'tokens' &&
          opts.sort !== 'buckets' &&
          opts.sort !== 'p99' &&
          opts.sort !== 'mean'
        ) {
          throw new Error(
            `--sort must be 'tokens' | 'buckets' | 'p99' | 'mean' (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildTokenVelocityPercentiles(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minBuckets,
          top,
          rateMin,
          sort: opts.sort as 'tokens' | 'buckets' | 'p99' | 'mean',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderTokenVelocityPercentiles(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('cost-per-bucket-percentiles')
  .description(
    'Per-source distribution of estimated USD cost per (source, UTC hour) bucket; reports p50/p90/p99 dollars-per-bucket plus min/max/mean per source',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--min-buckets <n>',
    'hide source rows with fewer than n active buckets; counts surface as droppedMinBuckets (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sorting; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--min-cost <usd>',
    'noise-floor: drop individual (source, hour) buckets whose USD cost is < n; counts surface as droppedMinCost (default 0)',
    '0',
  )
  .option(
    '--top-buckets <n>',
    'tail-zoom: keep only the top n highest-cost buckets *per source* before percentile computation; counts surface as droppedTopBuckets (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    "sort key for sources[]: 'cost' (default) | 'buckets' | 'p99' | 'mean'",
    'cost',
  )
  .option('--rates <path>', 'override rates JSON path (default ~/.config/pew-insights/rates.json)')
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minBuckets: string;
        top: string;
        minCost: string;
        topBuckets: string;
        sort: string;
        rates?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minBuckets = Number.parseInt(opts.minBuckets, 10);
        if (!Number.isInteger(minBuckets) || minBuckets < 0) {
          throw new Error(`--min-buckets must be a non-negative integer (got ${opts.minBuckets})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const minCost = Number.parseFloat(opts.minCost);
        if (!Number.isFinite(minCost) || minCost < 0) {
          throw new Error(`--min-cost must be a non-negative finite number (got ${opts.minCost})`);
        }
        const topBuckets = Number.parseInt(opts.topBuckets, 10);
        if (!Number.isInteger(topBuckets) || topBuckets < 0) {
          throw new Error(`--top-buckets must be a non-negative integer (got ${opts.topBuckets})`);
        }
        if (
          opts.sort !== 'cost' &&
          opts.sort !== 'buckets' &&
          opts.sort !== 'p99' &&
          opts.sort !== 'mean'
        ) {
          throw new Error(
            `--sort must be 'cost' | 'buckets' | 'p99' | 'mean' (got ${opts.sort})`,
          );
        }
        const ratesPath = opts.rates ?? defaultRatesPath();
        const userRates = await readRatesFile(ratesPath);
        const rates = mergeRates(DEFAULT_RATES, userRates);
        const queue = await readQueue(paths);
        const report = buildCostPerBucketPercentiles(queue, rates, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minBuckets,
          top,
          minCost,
          topBuckets,
          sort: opts.sort as 'cost' | 'buckets' | 'p99' | 'mean',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderCostPerBucketPercentiles(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('rolling-bucket-cv')
  .description(
    'Per-source distribution of rolling-window coefficient-of-variation (CV) of token-per-bucket; reveals how spikiness evolves over a source\'s tenure rather than collapsing it to a single scalar like burstiness',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--window-size <n>',
    'rolling window width measured in consecutive active buckets (default 12, must be >= 2)',
    '12',
  )
  .option(
    '--min-buckets <n>',
    'hide source rows with fewer than n active buckets; counts surface as droppedMinBuckets (default 0)',
    '0',
  )
  .option(
    '--min-window-cv <x>',
    'noise-floor: drop individual rolling windows whose CV is < x before per-source aggregation; counts surface as droppedLowCvWindows. Sources whose every window falls below the floor surface as droppedAllWindowsFloored. Default 0 keeps every window.',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n sources by total tokens; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        windowSize: string;
        minBuckets: string;
        minWindowCv: string;
        top: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const windowSize = Number.parseInt(opts.windowSize, 10);
        if (!Number.isInteger(windowSize) || windowSize < 2) {
          throw new Error(`--window-size must be an integer >= 2 (got ${opts.windowSize})`);
        }
        const minBuckets = Number.parseInt(opts.minBuckets, 10);
        if (!Number.isInteger(minBuckets) || minBuckets < 0) {
          throw new Error(`--min-buckets must be a non-negative integer (got ${opts.minBuckets})`);
        }
        const minWindowCv = Number.parseFloat(opts.minWindowCv);
        if (!Number.isFinite(minWindowCv) || minWindowCv < 0) {
          throw new Error(`--min-window-cv must be a non-negative finite number (got ${opts.minWindowCv})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const queue = await readQueue(paths);
        const report = buildRollingBucketCv(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          windowSize,
          minBuckets,
          minWindowCv,
          top,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderRollingBucketCv(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('daily-token-autocorrelation-lag1')
  .description(
    'Per-source lag-1 (Pearson) autocorrelation of daily token totals; reveals day-to-day persistence (does today predict tomorrow?) which is invisible to magnitude-only metrics like burstiness or rolling-bucket-cv',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--min-days <n>',
    'hide source rows with fewer than n active calendar days; counts surface as droppedSparseSources (default 3, must be >= 3)',
    '3',
  )
  .option(
    '--top <n>',
    'show only the top n sources by total tokens; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    'sort key for the per-source table: tokens | rho1active | rho1filled | ndays (default tokens). Applied before --top so it changes which sources are kept under a non-zero cap.',
    'tokens',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minDays: string;
        top: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minDays = Number.parseInt(opts.minDays, 10);
        if (!Number.isInteger(minDays) || minDays < 3) {
          throw new Error(`--min-days must be an integer >= 3 (got ${opts.minDays})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const sort = opts.sort as 'tokens' | 'rho1active' | 'rho1filled' | 'ndays';
        if (!['tokens', 'rho1active', 'rho1filled', 'ndays'].includes(sort)) {
          throw new Error(`--sort must be one of tokens|rho1active|rho1filled|ndays (got ${opts.sort})`);
        }
        const queue = await readQueue(paths);
        const report = buildDailyTokenAutocorrelationLag1(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minDays,
          top,
          sort,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderDailyTokenAutocorrelationLag1(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('daily-token-monotone-run-length')
  .description(
    "Per-source longest run of strictly monotone (increasing or decreasing) consecutive daily total-token values, plus the live trailing run direction & length. Trajectory-shape statistic orthogonal to autocorrelation (mean-shape) and burstiness/gini (dispersion).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--min-days <n>',
    'hide source rows with fewer than n active calendar days (default 2, must be >= 2); counts surface as droppedSparseSources',
    '2',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sort; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    'sort key: tokens (default) | longest | up | down | current | ndays | source. Applied before --top.',
    'tokens',
  )
  .option(
    '--min-longest-run <n>',
    'display filter: hide sources whose longestMonotoneRun is below n; counts surface as droppedBelowMinLongestRun (default 0 = no floor)',
    '0',
  )
  .option(
    '--current-direction <dirs>',
    "display filter: keep only sources whose currentDirection is in this comma-separated list (one or more of 'up','down','flat'); counts surface as droppedByCurrentDirection. Useful for surfacing sources currently climbing / falling / plateaued.",
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minDays: string;
        top: string;
        sort: string;
        minLongestRun: string;
        currentDirection?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minDays = Number.parseInt(opts.minDays, 10);
        if (!Number.isInteger(minDays) || minDays < 2) {
          throw new Error(`--min-days must be an integer >= 2 (got ${opts.minDays})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const minLongestRun = Number.parseInt(opts.minLongestRun, 10);
        if (!Number.isInteger(minLongestRun) || minLongestRun < 0) {
          throw new Error(
            `--min-longest-run must be a non-negative integer (got ${opts.minLongestRun})`,
          );
        }
        const sort = opts.sort as
          | 'tokens'
          | 'longest'
          | 'up'
          | 'down'
          | 'current'
          | 'ndays'
          | 'source';
        const validSorts = ['tokens', 'longest', 'up', 'down', 'current', 'ndays', 'source'];
        if (!validSorts.includes(sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        let currentDirection: ('up' | 'down' | 'flat')[] | null = null;
        if (opts.currentDirection != null && opts.currentDirection !== '') {
          const parts = opts.currentDirection
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          if (parts.length === 0) {
            throw new Error(
              `--current-direction must be a non-empty comma-separated list (got '${opts.currentDirection}')`,
            );
          }
          for (const p of parts) {
            if (p !== 'up' && p !== 'down' && p !== 'flat') {
              throw new Error(
                `--current-direction entries must be 'up'|'down'|'flat' (got '${p}')`,
              );
            }
          }
          currentDirection = parts as ('up' | 'down' | 'flat')[];
        }
        const report = buildDailyTokenMonotoneRunLength(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minDays,
          top,
          sort,
          minLongestRun,
          currentDirection,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderDailyTokenMonotoneRunLength(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('daily-token-zscore-extremes')
  .description(
    "Per-source count of daily total-token values whose population z-score exceeds ±sigma. Tail-event statistic that surfaces individual extreme days (heavy or light) — orthogonal to aggregate dispersion (burstiness, rolling-bucket-cv), serial correlation (autocorrelation-lag1), and direction-persistence (monotone-run-length).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--min-days <n>',
    'hide source rows with fewer than n active calendar days (default 3, must be >= 2); counts surface as droppedSparseSources',
    '3',
  )
  .option(
    '--sigma <f>',
    'strict z-score threshold; days with |z| > sigma count as extreme. Must be > 0. Default 2.',
    '2',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sort; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    'sort key: tokens (default) | extreme | fraction | maxabsz | ndays | source. Applied before --top.',
    'tokens',
  )
  .option(
    '--min-extreme <n>',
    'display filter: hide sources whose nExtreme is below n; counts surface as droppedBelowMinExtreme (default 0 = no floor)',
    '0',
  )
  .option(
    '--direction <dir>',
    "display filter: keep only sources with at least one extreme of the given direction. One of high|low|either. Default unset = no direction gate.",
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minDays: string;
        sigma: string;
        top: string;
        sort: string;
        minExtreme: string;
        direction?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minDays = Number.parseInt(opts.minDays, 10);
        if (!Number.isInteger(minDays) || minDays < 2) {
          throw new Error(`--min-days must be an integer >= 2 (got ${opts.minDays})`);
        }
        const sigma = Number.parseFloat(opts.sigma);
        if (!Number.isFinite(sigma) || sigma <= 0) {
          throw new Error(`--sigma must be a positive finite number (got ${opts.sigma})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const minExtreme = Number.parseInt(opts.minExtreme, 10);
        if (!Number.isInteger(minExtreme) || minExtreme < 0) {
          throw new Error(`--min-extreme must be a non-negative integer (got ${opts.minExtreme})`);
        }
        let direction: 'high' | 'low' | 'either' | null = null;
        if (opts.direction != null && opts.direction !== '') {
          if (!['high', 'low', 'either'].includes(opts.direction)) {
            throw new Error(`--direction must be one of high|low|either (got ${opts.direction})`);
          }
          direction = opts.direction as 'high' | 'low' | 'either';
        }
        const sort = opts.sort as
          | 'tokens'
          | 'extreme'
          | 'fraction'
          | 'maxabsz'
          | 'ndays'
          | 'source';
        const validSorts = ['tokens', 'extreme', 'fraction', 'maxabsz', 'ndays', 'source'];
        if (!validSorts.includes(sort)) {
          throw new Error(`--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`);
        }
        const queue = await readQueue(paths);
        const report = buildDailyTokenZscoreExtremes(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minDays,
          sigma,
          top,
          sort,
          minExtreme,
          direction,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderDailyTokenZscoreExtremes(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('cumulative-tokens-midpoint')
  .description(
    'Per-source: day at which cumulative tokens crosses 50% of lifetime, expressed as a percentile of the source\u2019s own calendar tenure (gap-filled with zero days). <0.5 = front-loaded, ~0.5 = uniform, >0.5 = back-loaded.',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-days <n>',
    'drop sources with fewer than n distinct tokens-bearing days from the per-source table (default 1)',
    '1',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + minDays; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key for sources[]: 'tokens' (default) | 'midpoint' | 'tenure' | 'source'",
    'tokens',
  )
  .option(
    '--midpoint-min <f>',
    'drop sources whose midpointPctTenure is below f from the per-source table; must be in [0, 1] (default 0); suppressed rows surface as droppedBelowMidpointMin',
    '0',
  )
  .option(
    '--midpoint-max <f>',
    'drop sources whose midpointPctTenure is above f from the per-source table; must be in [0, 1] (default 1); suppressed rows surface as droppedAboveMidpointMax',
    '1',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minDays: string;
        top?: string;
        sort: string;
        midpointMin: string;
        midpointMax: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minDays = Number.parseInt(opts.minDays, 10);
        if (!Number.isInteger(minDays) || minDays < 1) {
          throw new Error(
            `--min-days must be a positive integer (got ${opts.minDays})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const sort = opts.sort;
        if (
          sort !== 'tokens' &&
          sort !== 'midpoint' &&
          sort !== 'tenure' &&
          sort !== 'source'
        ) {
          throw new Error(
            `--sort must be 'tokens' | 'midpoint' | 'tenure' | 'source' (got ${opts.sort})`,
          );
        }
        const midpointMin = Number.parseFloat(opts.midpointMin);
        if (!Number.isFinite(midpointMin) || midpointMin < 0 || midpointMin > 1) {
          throw new Error(
            `--midpoint-min must be in [0, 1] (got ${opts.midpointMin})`,
          );
        }
        const midpointMax = Number.parseFloat(opts.midpointMax);
        if (!Number.isFinite(midpointMax) || midpointMax < 0 || midpointMax > 1) {
          throw new Error(
            `--midpoint-max must be in [0, 1] (got ${opts.midpointMax})`,
          );
        }
        if (midpointMin > midpointMax) {
          throw new Error(
            `--midpoint-min (${midpointMin}) must be <= --midpoint-max (${midpointMax})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildCumulativeTokensMidpoint(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minDays,
          top,
          sort: sort as 'tokens' | 'midpoint' | 'tenure' | 'source',
          midpointMin,
          midpointMax,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderCumulativeTokensMidpoint(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-io-ratio-stability')
  .description(
    "Per-source coefficient of variation (stddev/mean) of the daily output_tokens/input_tokens ratio across the source's active calendar days. Low CV = stable interaction shape day-over-day; high CV = swings between mostly-prompt and mostly-generation. Distinct from output-input-ratio (single global mean) and from autocorrelation (magnitude persistence).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-days <n>',
    'drop sources with fewer than n ratio-bearing days (input_tokens > 0) from the per-source table (default 3)',
    '3',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + minDays; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key for sources[]: 'tokens' (default) | 'cv' | 'mean' | 'days' | 'source'",
    'tokens',
  )
  .option(
    '--cv-min <f>',
    'drop sources whose ratioCv is below f (non-negative finite); useful for surfacing the wild ones; suppressed rows surface as droppedBelowCvMin (default 0)',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minDays: string;
        top?: string;
        sort: string;
        cvMin: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minDays = Number.parseInt(opts.minDays, 10);
        if (!Number.isInteger(minDays) || minDays < 1) {
          throw new Error(
            `--min-days must be a positive integer (got ${opts.minDays})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const sort = opts.sort;
        if (
          sort !== 'tokens' &&
          sort !== 'cv' &&
          sort !== 'mean' &&
          sort !== 'days' &&
          sort !== 'source'
        ) {
          throw new Error(
            `--sort must be 'tokens' | 'cv' | 'mean' | 'days' | 'source' (got ${opts.sort})`,
          );
        }
        const cvMin = Number.parseFloat(opts.cvMin);
        if (!Number.isFinite(cvMin) || cvMin < 0) {
          throw new Error(`--cv-min must be a non-negative finite number (got ${opts.cvMin})`);
        }
        const queue = await readQueue(paths);
        const report = buildSourceIoRatioStability(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minDays,
          top,
          sort: sort as 'tokens' | 'cv' | 'mean' | 'days' | 'source',
          cvMin,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceIoRatioStability(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-output-tokens-per-row-percentiles')
  .description(
    "Per-source distribution of output_tokens per individual queue row, reported as p50/p90/p99 plus mean/max and a tail = p99/p50 ratio. Distinct from output-size (per-model) and from output-token-decile-distribution (global) — this is the per-source generation-magnitude lens.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n positive-output rows (default 3)',
    '3',
  )
  .option(
    '--min-p99 <f>',
    'drop sources whose p99 output_tokens is below f (default 0)',
    '0',
  )
  .option(
    '--min-tail <f>',
    'drop sources whose p99/p50 (tail) is below f; useful for surfacing bimodal/heavy-tail sources (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'tokens' (default) | 'p50' | 'p90' | 'p99' | 'tail' | 'rows' | 'source'",
    'tokens',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minP99: string;
        minTail: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 1) {
          throw new Error(
            `--min-rows must be a positive integer (got ${opts.minRows})`,
          );
        }
        const minP99 = Number.parseFloat(opts.minP99);
        if (!Number.isFinite(minP99) || minP99 < 0) {
          throw new Error(
            `--min-p99 must be a non-negative finite number (got ${opts.minP99})`,
          );
        }
        const minTail = Number.parseFloat(opts.minTail);
        if (!Number.isFinite(minTail) || minTail < 0) {
          throw new Error(
            `--min-tail must be a non-negative finite number (got ${opts.minTail})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = ['tokens', 'p50', 'p90', 'p99', 'tail', 'rows', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceOutputTokensPerRowPercentiles(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          top,
          sort: opts.sort as
            | 'tokens'
            | 'p50'
            | 'p90'
            | 'p99'
            | 'tail'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceOutputTokensPerRowPercentiles(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-lehmer-8-mean')
  .description(
    "Per-source Lehmer mean of order 8 (L_8) of per-row total_tokens. L_8 = sum(x^8) / sum(x^7). Extends v0.6.196's Lehmer ladder one step further to the right of L_7: HM <= GM <= AM <= QM <= CHM <= L_3 <= L_4 <= L_5 <= L_6 <= L_7 <= L_8 (Lehmer monotonicity). Equivalently, the x^7-self-weighted arithmetic mean — each row weights itself by its own SEVENTH POWER. Scale-equivariant, NOT translation-equivariant. Dominated by the LARGEST rows even more aggressively than L_7. l8L7Gap = L_8 - L_7, l8L6Gap = L_8 - L_6, l8AmGap = L_8 - mean are reported as free signals: ALL >= 0.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n non-negative kept rows; must be an integer >= 1 (default 1)',
    '1',
  )
  .option(
    '--min-lehmer-8-mean <f>',
    'drop sources whose Lehmer-8 mean is strictly below f; cohort selector. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'lehmer-8-mean-desc' (default) | 'lehmer-8-mean-asc' | 'mean-desc' | 'l7-gap-desc' (l8L7Gap desc) | 'l6-gap-desc' (l8L6Gap desc) | 'am-gap-desc' (l8AmGap desc) | 'rows' | 'source'",
    'lehmer-8-mean-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minLehmer8Mean: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 1) {
          throw new Error(
            `--min-rows must be an integer >= 1 (got ${opts.minRows})`,
          );
        }
        const minLehmer8Mean = Number.parseFloat(opts.minLehmer8Mean);
        if (!Number.isFinite(minLehmer8Mean) || minLehmer8Mean < 0) {
          throw new Error(
            `--min-lehmer-8-mean must be a finite, non-negative number (got ${opts.minLehmer8Mean})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'lehmer-8-mean-desc',
          'lehmer-8-mean-asc',
          'mean-desc',
          'l7-gap-desc',
          'l6-gap-desc',
          'am-gap-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenLehmer8Mean(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minLehmer8Mean,
          top,
          sort: opts.sort as
            | 'lehmer-8-mean-desc'
            | 'lehmer-8-mean-asc'
            | 'mean-desc'
            | 'l7-gap-desc'
            | 'l6-gap-desc'
            | 'am-gap-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenLehmer8Mean(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-lehmer-9-mean')
  .description(
    "Per-source Lehmer mean of order 9 (L_9) of per-row total_tokens. L_9 = sum(x^9) / sum(x^8). Extends v0.6.197's Lehmer ladder one step further to the right of L_8: HM <= GM <= AM <= QM <= CHM <= L_3 <= L_4 <= L_5 <= L_6 <= L_7 <= L_8 <= L_9 (Lehmer monotonicity). Equivalently, the x^8-self-weighted arithmetic mean — each row weights itself by its own EIGHTH POWER. Scale-equivariant, NOT translation-equivariant. Dominated by the LARGEST rows even more aggressively than L_8. l9L8Gap = L_9 - L_8, l9L7Gap = L_9 - L_7, l9AmGap = L_9 - mean are reported as free signals: ALL >= 0.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n non-negative kept rows; must be an integer >= 1 (default 1)',
    '1',
  )
  .option(
    '--min-lehmer-9-mean <f>',
    'drop sources whose Lehmer-9 mean is strictly below f; cohort selector. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'lehmer-9-mean-desc' (default) | 'lehmer-9-mean-asc' | 'mean-desc' | 'l8-gap-desc' (l9L8Gap desc) | 'l7-gap-desc' (l9L7Gap desc) | 'am-gap-desc' (l9AmGap desc) | 'rows' | 'source'",
    'lehmer-9-mean-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minLehmer9Mean: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 1) {
          throw new Error(
            `--min-rows must be an integer >= 1 (got ${opts.minRows})`,
          );
        }
        const minLehmer9Mean = Number.parseFloat(opts.minLehmer9Mean);
        if (!Number.isFinite(minLehmer9Mean) || minLehmer9Mean < 0) {
          throw new Error(
            `--min-lehmer-9-mean must be a finite, non-negative number (got ${opts.minLehmer9Mean})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'lehmer-9-mean-desc',
          'lehmer-9-mean-asc',
          'mean-desc',
          'l8-gap-desc',
          'l7-gap-desc',
          'am-gap-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenLehmer9Mean(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minLehmer9Mean,
          top,
          sort: opts.sort as
            | 'lehmer-9-mean-desc'
            | 'lehmer-9-mean-asc'
            | 'mean-desc'
            | 'l8-gap-desc'
            | 'l7-gap-desc'
            | 'am-gap-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenLehmer9Mean(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-lehmer-10-mean')
  .description(
    "Per-source Lehmer mean of order 10 (L_10) of per-row total_tokens. L_10 = sum(x^10) / sum(x^9). Extends v0.6.198's Lehmer ladder one step further to the right of L_9: HM <= GM <= AM <= QM <= CHM <= L_3 <= L_4 <= L_5 <= L_6 <= L_7 <= L_8 <= L_9 <= L_10 (Lehmer monotonicity). Equivalently, the x^9-self-weighted arithmetic mean — each row weights itself by its own NINTH POWER. Scale-equivariant, NOT translation-equivariant. Dominated by the LARGEST rows even more aggressively than L_9. l10L9Gap = L_10 - L_9, l10L8Gap = L_10 - L_8, l10AmGap = L_10 - mean are reported as free signals: ALL >= 0.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n non-negative kept rows; must be an integer >= 1 (default 1)',
    '1',
  )
  .option(
    '--min-lehmer-10-mean <f>',
    'drop sources whose Lehmer-10 mean is strictly below f; cohort selector. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'lehmer-10-mean-desc' (default) | 'lehmer-10-mean-asc' | 'mean-desc' | 'l9-gap-desc' (l10L9Gap desc) | 'l8-gap-desc' (l10L8Gap desc) | 'am-gap-desc' (l10AmGap desc) | 'rows' | 'source'",
    'lehmer-10-mean-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minLehmer10Mean: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 1) {
          throw new Error(
            `--min-rows must be an integer >= 1 (got ${opts.minRows})`,
          );
        }
        const minLehmer10Mean = Number.parseFloat(opts.minLehmer10Mean);
        if (!Number.isFinite(minLehmer10Mean) || minLehmer10Mean < 0) {
          throw new Error(
            `--min-lehmer-10-mean must be a finite, non-negative number (got ${opts.minLehmer10Mean})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'lehmer-10-mean-desc',
          'lehmer-10-mean-asc',
          'mean-desc',
          'l9-gap-desc',
          'l8-gap-desc',
          'am-gap-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenLehmer10Mean(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minLehmer10Mean,
          top,
          sort: opts.sort as
            | 'lehmer-10-mean-desc'
            | 'lehmer-10-mean-asc'
            | 'mean-desc'
            | 'l9-gap-desc'
            | 'l8-gap-desc'
            | 'am-gap-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenLehmer10Mean(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-lehmer-11-mean')
  .description(
    "Per-source Lehmer mean of order 11 (L_11) of per-row total_tokens. L_11 = sum(x^11) / sum(x^10). Extends v0.6.199's Lehmer ladder one step further to the right of L_10. Equivalently, the x^10-self-weighted arithmetic mean — each row weights itself by its own TENTH POWER. Scale-equivariant, NOT translation-equivariant. Dominated by the LARGEST rows even more aggressively than L_10. l11L10Gap = L_11 - L_10, l11L9Gap = L_11 - L_9, l11AmGap = L_11 - mean are reported as free signals: ALL >= 0.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n non-negative kept rows; must be an integer >= 1 (default 1)',
    '1',
  )
  .option(
    '--min-lehmer-11-mean <f>',
    'drop sources whose Lehmer-11 mean is strictly below f; cohort selector. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'lehmer-11-mean-desc' (default) | 'lehmer-11-mean-asc' | 'mean-desc' | 'l10-gap-desc' (l11L10Gap desc) | 'l9-gap-desc' (l11L9Gap desc) | 'am-gap-desc' (l11AmGap desc) | 'rows' | 'source'",
    'lehmer-11-mean-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minLehmer11Mean: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 1) {
          throw new Error(
            `--min-rows must be an integer >= 1 (got ${opts.minRows})`,
          );
        }
        const minLehmer11Mean = Number.parseFloat(opts.minLehmer11Mean);
        if (!Number.isFinite(minLehmer11Mean) || minLehmer11Mean < 0) {
          throw new Error(
            `--min-lehmer-11-mean must be a finite, non-negative number (got ${opts.minLehmer11Mean})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'lehmer-11-mean-desc',
          'lehmer-11-mean-asc',
          'mean-desc',
          'l10-gap-desc',
          'l9-gap-desc',
          'am-gap-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenLehmer11Mean(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minLehmer11Mean,
          top,
          sort: opts.sort as
            | 'lehmer-11-mean-desc'
            | 'lehmer-11-mean-asc'
            | 'mean-desc'
            | 'l10-gap-desc'
            | 'l9-gap-desc'
            | 'am-gap-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenLehmer11Mean(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );


program
  .command('source-row-token-lehmer-12-mean')
  .description(
    "Per-source Lehmer mean of order 12 (L_12) of per-row total_tokens. L_12 = sum(x^12) / sum(x^11). Extends v0.6.200's Lehmer ladder one step further to the right of L_11. Equivalently, the x^11-self-weighted arithmetic mean — each row weights itself by its own ELEVENTH POWER. Scale-equivariant, NOT translation-equivariant. Dominated by the LARGEST rows even more aggressively than L_11. l12L11Gap = L_12 - L_11, l12L10Gap = L_12 - L_10, l12AmGap = L_12 - mean are reported as free signals: ALL >= 0.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n non-negative kept rows; must be an integer >= 1 (default 1)',
    '1',
  )
  .option(
    '--min-lehmer-12-mean <f>',
    'drop sources whose Lehmer-11 mean is strictly below f; cohort selector. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'lehmer-12-mean-desc' (default) | 'lehmer-12-mean-asc' | 'mean-desc' | 'l11-gap-desc' (l12L11Gap desc) | 'l10-gap-desc' (l12L10Gap desc) | 'am-gap-desc' (l12AmGap desc) | 'rows' | 'source'",
    'lehmer-12-mean-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minLehmer12Mean: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 1) {
          throw new Error(
            `--min-rows must be an integer >= 1 (got ${opts.minRows})`,
          );
        }
        const minLehmer12Mean = Number.parseFloat(opts.minLehmer12Mean);
        if (!Number.isFinite(minLehmer12Mean) || minLehmer12Mean < 0) {
          throw new Error(
            `--min-lehmer-12-mean must be a finite, non-negative number (got ${opts.minLehmer12Mean})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'lehmer-12-mean-desc',
          'lehmer-12-mean-asc',
          'mean-desc',
          'l11-gap-desc',
          'l10-gap-desc',
          'am-gap-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenLehmer12Mean(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minLehmer12Mean,
          top,
          sort: opts.sort as
            | 'lehmer-12-mean-desc'
            | 'lehmer-12-mean-asc'
            | 'mean-desc'
            | 'l11-gap-desc'
            | 'l10-gap-desc'
            | 'am-gap-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenLehmer12Mean(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-winsorized-mean-10')
  .description(
    "Per-source 10 % symmetrically winsorized mean of per-row total_tokens. Sort the rows, REPLACE the bottom k = floor(0.10 n) order statistics with x_(k+1) and the top k with x_(n-k), then take the arithmetic mean of all n now-clipped rows. Symmetric L-estimator with 10 % breakdown. Unlike trim-mean-25 which DISCARDS the trimmed tails (zero contribution to numerator AND denominator), winsorized-mean CLIPS the tails to boundary values (boundary contributes to numerator, row still counts in denominator). Translation- and scale-equivariant. Distinct from every existing source-row-token-* lens: source-row-token-trim-mean-25 drops 25 % of each tail entirely; this lens clips 10 % of each tail to the boundary. source-row-token-mid-range = (min+max)/2 listens to ONLY the two tails (0 % breakdown); winsorized-mean-10 clips them (10 % breakdown). source-row-token-midhinge = (q1+q3)/2 weights ZERO central rows. source-row-token-trimean = (q1+2*median+q3)/4 weights three quantiles. source-row-token-mad reports a SPREAD; source-row-token-coefficient-of-quartile-deviation, source-row-token-bowley-skewness, source-row-token-iqr-ratio measure SHAPE; source-row-token-coefficient-of-variation, source-row-token-burstiness-coefficient, source-row-token-skewness, source-row-token-kurtosis, source-row-token-gini are MOMENT- or distribution-shape statistics. Distinct from every Lehmer / Pythagorean / contraharmonic mean: those are POWER-weighted (each row weights itself by some power of its own value), non-linear in row values, NOT translation-equivariant; this lens is a linear L-estimator, translation- AND scale-equivariant. wmMeanGap = winsorized_mean - mean is reported as a free signal: negative means the raw mean is being pulled UP by an upper tail that the winsorized mean clips out; positive means a lower tail is dragging the raw mean down.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; must be an integer >= 10 (need k = floor(0.10 n) >= 1 to actually winsorize) (default 10)',
    '10',
  )
  .option(
    '--min-winsorized-mean <f>',
    'drop sources whose winsorized-mean is strictly below f; cohort selector for "this source actually carries non-trivial body-location token magnitude". f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'winsorized-mean-desc' (default) | 'winsorized-mean-asc' | 'mean-desc' | 'gap-desc' (|wmMeanGap| desc — mean furthest from clipped body first) | 'rows' | 'source'",
    'winsorized-mean-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minWinsorizedMean: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 10) {
          throw new Error(
            `--min-rows must be an integer >= 10 (got ${opts.minRows})`,
          );
        }
        const minWinsorizedMean = Number.parseFloat(opts.minWinsorizedMean);
        if (!Number.isFinite(minWinsorizedMean) || minWinsorizedMean < 0) {
          throw new Error(
            `--min-winsorized-mean must be a finite, non-negative number (got ${opts.minWinsorizedMean})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'winsorized-mean-desc',
          'winsorized-mean-asc',
          'mean-desc',
          'gap-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenWinsorizedMean10(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minWinsorizedMean,
          top,
          sort: opts.sort as
            | 'winsorized-mean-desc'
            | 'winsorized-mean-asc'
            | 'mean-desc'
            | 'gap-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenWinsorizedMean10(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-winsorized-mean-20')
  .description(
    "Per-source 20 % symmetrically winsorized mean of per-row total_tokens. Sort the rows, REPLACE the bottom k = floor(0.20 n) order statistics with x_(k+1) and the top k with x_(n-k), then take the arithmetic mean of all n now-clipped rows. Symmetric L-estimator with 20 % breakdown — strictly more robust than winsorized-mean-10 (10 % breakdown) and the mean / mid-range (0 % breakdown), strictly less robust than the median (50 %) and the 25 % trimmed mean (25 %). Doubles the tail-attenuation budget of winsorized-mean-10: at n = 100 it clips the 20 most extreme rows to the boundary instead of the 10 most extreme. Unlike trim-mean-25 which DISCARDS the trimmed tails, winsorized-mean CLIPS the tails to boundary values (boundary contributes to numerator, row still counts in denominator). Translation- and scale-equivariant. Distinct from every existing source-row-token-* lens including winsorized-mean-10 (different alpha 0.20 vs 0.10, different breakdown 20 % vs 10 %, different boundary positions x_(k+1)/x_(n-k) at different k). Distinct from trim-mean-25 (different fraction 20 vs 25, different mechanism clip vs drop). source-row-token-mid-range = (min+max)/2 listens to ONLY the two tails; this lens clips them. source-row-token-midhinge = (q1+q3)/2 weights ZERO central rows. source-row-token-trimean weights three quantiles. source-row-token-mad reports a SPREAD; CQD/Bowley/IQR-ratio measure SHAPE; CV/burstiness/skewness/kurtosis/gini are MOMENT- or distribution-shape statistics. Distinct from every Lehmer / contraharmonic mean: those are POWER-weighted, non-linear in row values, NOT translation-equivariant; this lens is a linear L-estimator. wmMeanGap = winsorized_mean - mean is reported as a free signal: negative means an upper tail is pulling the raw mean up that the winsorized mean clips out; positive means a lower tail is dragging the raw mean down.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; must be an integer >= 10 (with alpha = 0.20, n = 10 yields k = 2 — the smallest meaningful symmetric 20 % winsorization) (default 10)',
    '10',
  )
  .option(
    '--min-winsorized-mean <f>',
    'drop sources whose winsorized-mean is strictly below f; cohort selector for "this source actually carries non-trivial body-location token magnitude". f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'winsorized-mean-desc' (default) | 'winsorized-mean-asc' | 'mean-desc' | 'gap-desc' (|wmMeanGap| desc — mean furthest from clipped body first) | 'rows' | 'source'",
    'winsorized-mean-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minWinsorizedMean: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 10) {
          throw new Error(
            `--min-rows must be an integer >= 10 (got ${opts.minRows})`,
          );
        }
        const minWinsorizedMean = Number.parseFloat(opts.minWinsorizedMean);
        if (!Number.isFinite(minWinsorizedMean) || minWinsorizedMean < 0) {
          throw new Error(
            `--min-winsorized-mean must be a finite, non-negative number (got ${opts.minWinsorizedMean})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'winsorized-mean-desc',
          'winsorized-mean-asc',
          'mean-desc',
          'gap-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenWinsorizedMean20(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minWinsorizedMean,
          top,
          sort: opts.sort as
            | 'winsorized-mean-desc'
            | 'winsorized-mean-asc'
            | 'mean-desc'
            | 'gap-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenWinsorizedMean20(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-trim-mean-10')
  .description(
    "Per-source 10 % symmetrically trimmed mean of per-row total_tokens. Sort the rows, DROP the bottom k = floor(0.10 n) and top k order statistics entirely, then take the arithmetic mean of the central n - 2k surviving rows. Symmetric L-estimator with 10 % breakdown. Mechanically distinct from source-row-token-winsorized-mean-10 (same alpha = 0.10 but CLIPS tails to boundary values vs DROPS them; WM-10 denominator is n, TM-10 denominator is n - 2k). Mechanically distinct from source-row-token-trim-mean-25 (same DROP mechanism but different alpha; TM-25 drops 25 % of each tail and is strictly more robust). Translation- and scale-equivariant. source-row-token-mid-range = (min+max)/2 listens to ONLY the two tails (0 % breakdown); TM-10 discards the bottom and top 10 % entirely. source-row-token-midhinge / trimean weight only quantiles; TM-10 averages every row in the central 80 % so it is sensitive to body shape. source-row-token-mad reports a SPREAD; CQD/Bowley/IQR-ratio measure SHAPE; CV/burstiness/skewness/kurtosis/gini are MOMENT- or distribution-shape statistics. Distinct from harmonic / quadratic / contraharmonic / Lehmer-k means: those are POWER-weighted, non-linear, NOT translation-equivariant; TM-10 is a linear L-estimator. tmMeanGap = trim_mean - mean is reported as a free signal: negative means the raw mean is being pulled UP by an upper tail that the trimmed mean filters out; positive means a lower tail is dragging the raw mean down. Free byproducts loBoundary = x_(k+1), hiBoundary = x_(n-k), and trimmedPerTail = k expose where the trim cut falls.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; must be an integer >= 10 (need k = floor(0.10 n) >= 1 to actually trim — at n < 10, k = 0 and the trimmed mean degenerates to the arithmetic mean) (default 10)',
    '10',
  )
  .option(
    '--min-trim-mean <f>',
    'drop sources whose trim-mean is strictly below f; cohort selector for "this source actually carries non-trivial body-location token magnitude". f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'trim-mean-desc' (default) | 'trim-mean-asc' | 'mean-desc' | 'gap-desc' (|tmMeanGap| desc) | 'rows' | 'source'",
    'trim-mean-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minTrimMean: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 10) {
          throw new Error(
            `--min-rows must be an integer >= 10 (got ${opts.minRows})`,
          );
        }
        const minTrimMean = Number.parseFloat(opts.minTrimMean);
        if (!Number.isFinite(minTrimMean) || minTrimMean < 0) {
          throw new Error(
            `--min-trim-mean must be a finite, non-negative number (got ${opts.minTrimMean})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'trim-mean-desc',
          'trim-mean-asc',
          'mean-desc',
          'gap-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenTrimMean10(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minTrimMean,
          top,
          sort: opts.sort as
            | 'trim-mean-desc'
            | 'trim-mean-asc'
            | 'mean-desc'
            | 'gap-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRowTokenTrimMean10(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-trim-mean-20')
  .description(
    "Per-source 20 % symmetrically trimmed mean of per-row total_tokens. Sort the rows, DROP the bottom k = floor(0.20 n) and top k order statistics entirely, then take the arithmetic mean of the central n - 2k surviving rows. Symmetric L-estimator with 20 % breakdown — strictly more robust than mean / mid-range (0 %) and TM-10 (10 %), strictly less than TM-25 (25 %) and median (50 %). Mechanically distinct from source-row-token-winsorized-mean-20 (same alpha = 0.20 but CLIPS tails to boundary values vs DROPS them; WM-20 denominator is n, TM-20 denominator is n - 2k). Mechanically distinct from source-row-token-trim-mean-10 (same DROP mechanism but different alpha; TM-20 trims twice as much per tail). Mechanically distinct from source-row-token-trim-mean-25 (same DROP mechanism, different alpha; TM-20 retains a wider central body). Translation- and scale-equivariant. tmMeanGap = trim_mean - mean is reported as a free signal: negative means the raw mean is being pulled UP by an upper tail that the trimmed mean filters out; positive means a lower tail is dragging the raw mean down. Free byproducts loBoundary = x_(k+1), hiBoundary = x_(n-k), and trimmedPerTail = k expose where the trim cut falls.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; must be an integer >= 5 (need k = floor(0.20 n) >= 1 to actually trim — at n < 5, k = 0 and the trimmed mean degenerates to the arithmetic mean) (default 5)',
    '5',
  )
  .option(
    '--min-trim-mean <f>',
    'drop sources whose trim-mean is strictly below f; cohort selector for "this source actually carries non-trivial body-location token magnitude". f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'trim-mean-desc' (default) | 'trim-mean-asc' | 'mean-desc' | 'gap-desc' (|tmMeanGap| desc) | 'rows' | 'source'",
    'trim-mean-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minTrimMean: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 5) {
          throw new Error(
            `--min-rows must be an integer >= 5 (got ${opts.minRows})`,
          );
        }
        const minTrimMean = Number.parseFloat(opts.minTrimMean);
        if (!Number.isFinite(minTrimMean) || minTrimMean < 0) {
          throw new Error(
            `--min-trim-mean must be a finite, non-negative number (got ${opts.minTrimMean})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'trim-mean-desc',
          'trim-mean-asc',
          'mean-desc',
          'gap-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenTrimMean20(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minTrimMean,
          top,
          sort: opts.sort as
            | 'trim-mean-desc'
            | 'trim-mean-asc'
            | 'mean-desc'
            | 'gap-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRowTokenTrimMean20(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-trim-mean-30')
  .description(
    "Per-source 30 % symmetrically trimmed mean of per-row total_tokens. Sort the rows, DROP the bottom k = floor(0.30 n) and top k order statistics entirely, then take the arithmetic mean of the central n - 2k surviving rows. Symmetric L-estimator with 30 % breakdown — strictly more robust than every shipped trim-mean lens (TM-10 at 10 %, TM-20 at 20 %, TM-25 at 25 %), strictly less than the median (50 %). Mechanically distinct from every winsorized-mean lens at any alpha (CLIPS tails to boundary values vs DROPS them; WM denominator is n, TM-30 denominator is n - 2k). Translation- and scale-equivariant. tmMeanGap = trim_mean - mean is reported as a free signal: negative means the raw mean is being pulled UP by an upper tail that the trimmed mean filters out; positive means a lower tail is dragging the raw mean down. Free byproducts loBoundary = x_(k+1), hiBoundary = x_(n-k), and trimmedPerTail = k expose where the trim cut falls.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; must be an integer >= 4 (need k = floor(0.30 n) >= 1 to actually trim — at n < 4, k = 0 and the trimmed mean degenerates to the arithmetic mean) (default 4)',
    '4',
  )
  .option(
    '--min-trim-mean <f>',
    'drop sources whose trim-mean is strictly below f; cohort selector for "this source actually carries non-trivial body-location token magnitude". f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'trim-mean-desc' (default) | 'trim-mean-asc' | 'mean-desc' | 'gap-desc' (|tmMeanGap| desc) | 'rows' | 'source'",
    'trim-mean-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minTrimMean: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        const minTrimMean = Number.parseFloat(opts.minTrimMean);
        if (!Number.isFinite(minTrimMean) || minTrimMean < 0) {
          throw new Error(
            `--min-trim-mean must be a finite, non-negative number (got ${opts.minTrimMean})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'trim-mean-desc',
          'trim-mean-asc',
          'mean-desc',
          'gap-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenTrimMean30(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minTrimMean,
          top,
          sort: opts.sort as
            | 'trim-mean-desc'
            | 'trim-mean-asc'
            | 'mean-desc'
            | 'gap-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRowTokenTrimMean30(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-hodges-lehmann')
  .description(
    "Per-source Hodges-Lehmann pseudo-median of per-row total_tokens. Form the multiset W of all n*(n+1)/2 Walsh averages (x_i + x_j)/2 for i <= j, then take HL = median(W). NOT an L-estimator: every shipped per-source row-token location lens (mean / mid-range / trim-mean-{10,20,25,30} / winsorized-mean-{10,20} / median / midhinge / trimean / IQM) is a fixed linear combination of order statistics. HL is an R-estimator / U-statistic — the canonical Wilcoxon-signed-rank-derived location estimator. Asymptotic relative efficiency at the normal model is 3/pi ~ 0.955 (vs median's 2/pi ~ 0.637). Breakdown point ~ 1 - 1/sqrt(2) ~ 0.293, between trim-mean-25 and trim-mean-30. For asymmetric distributions HL estimates the center of symmetry of the symmetrized distribution (X+X')/2, generally between the population mean and median. hlMeanGap = HL - mean and hlMedianGap = HL - median are reported as free signals.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; must be an integer >= 4 (need n >= 4 for a meaningful Walsh-average multiset of size n*(n+1)/2 = 10) (default 4)',
    '4',
  )
  .option(
    '--min-hodges-lehmann <f>',
    'drop sources whose Hodges-Lehmann pseudo-median is strictly below f; cohort selector for "this source actually carries non-trivial body-location token magnitude". f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'hl-desc' (default) | 'hl-asc' | 'mean-desc' | 'median-desc' | 'mean-gap-desc' (|hlMeanGap| desc) | 'median-gap-desc' (|hlMedianGap| desc) | 'rows' | 'source'",
    'hl-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minHodgesLehmann: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        const minHodgesLehmann = Number.parseFloat(opts.minHodgesLehmann);
        if (!Number.isFinite(minHodgesLehmann) || minHodgesLehmann < 0) {
          throw new Error(
            `--min-hodges-lehmann must be a finite, non-negative number (got ${opts.minHodgesLehmann})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'hl-desc',
          'hl-asc',
          'mean-desc',
          'median-desc',
          'mean-gap-desc',
          'median-gap-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenHodgesLehmann(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minHodgesLehmann,
          top,
          sort: opts.sort as
            | 'hl-desc'
            | 'hl-asc'
            | 'mean-desc'
            | 'median-desc'
            | 'mean-gap-desc'
            | 'median-gap-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRowTokenHodgesLehmann(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-broadened-median')
  .description(
    "Per-source Harrell-Davis broadened median of per-row total_tokens. Weighted L-estimator HD = sum w_i * x_(i) where w_i = I_{i/n}(a,b) - I_{(i-1)/n}(a,b) and a = b = (n+1)/2 (Beta-CDF differences). SMOOTH L-estimator: every shipped median-family lens (median / midhinge / trimean / IQM / TM-{10,20,25,30} / WM-{10,20}) places 0/1 or uniform-on-a-subset weights on the order statistics; HD places a smooth Beta-derived bell with strictly positive weight on every order statistic. Same target as the population median (unlike Hodges-Lehmann which targets the center of symmetry of (X+X')/2). Lower finite-sample variance than the raw median; breakdown 0.5. Reports centerWeight (weight on the central order statistic), weightSpread (max(w_i) - min(w_i)), hdMeanGap = HD - mean, hdMedianGap = HD - median.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; must be an integer >= 4 (need n >= 4 for Beta(a,b) smoothing with a=b=(n+1)/2 to be meaningfully distinct from the raw median) (default 4)',
    '4',
  )
  .option(
    '--min-broadened-median <f>',
    'drop sources whose Harrell-Davis broadened median is strictly below f; cohort selector for "this source actually carries non-trivial body-location token magnitude". f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'hd-desc' (default) | 'hd-asc' | 'mean-desc' | 'median-desc' | 'mean-gap-desc' (|hdMeanGap| desc) | 'median-gap-desc' (|hdMedianGap| desc) | 'rows' | 'source'",
    'hd-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minBroadenedMedian: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        const minBroadenedMedian = Number.parseFloat(opts.minBroadenedMedian);
        if (!Number.isFinite(minBroadenedMedian) || minBroadenedMedian < 0) {
          throw new Error(
            `--min-broadened-median must be a finite, non-negative number (got ${opts.minBroadenedMedian})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'hd-desc',
          'hd-asc',
          'mean-desc',
          'median-desc',
          'mean-gap-desc',
          'median-gap-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenBroadenedMedian(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minBroadenedMedian,
          top,
          sort: opts.sort as
            | 'hd-desc'
            | 'hd-asc'
            | 'mean-desc'
            | 'median-desc'
            | 'mean-gap-desc'
            | 'median-gap-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRowTokenBroadenedMedian(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-m-estimator-huber')
  .description(
    "Per-source Huber M-estimator of location of per-row total_tokens. Solves sum_i psi_c((x_i - mu)/s) = 0 by IRLS with mu_0 = median, s = MAD/0.6745, psi_c(z) = z if |z|<=c else c*sign(z), c = 1.345 (canonical: ~95% asymptotic relative efficiency at the normal). FIRST M-ESTIMATOR in the suite — data-adaptive weights w_i = psi_c(z_i)/z_i depend on the residual itself. Mechanically distinct from L-estimators (mean / TM / WM / median / midhinge / trimean / IQM / HD broadened median: weights depend only on rank), distinct from power means (Lehmer / harmonic / contraharmonic / quadratic: fixed nonlinear transform), distinct from R-estimators (Hodges-Lehmann: ranks of pairwise Walsh averages). Bounded influence: any single observation's pull on mu is capped at c*s. Translation- and scale-equivariant. Reports clippedRows (rows with |z|>c at converged mu), iterations (IRLS step count), huberMeanGap = huber - mean, huberMedianGap = huber - median.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; must be an integer >= 4 (need n >= 4 for MAD scale to be meaningful) (default 4)',
    '4',
  )
  .option(
    '--min-huber <f>',
    'drop sources whose Huber M-estimate is strictly below f; cohort selector. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--c-tuning <f>',
    'Huber tuning constant c. Larger c -> closer to mean (less robust); smaller c -> closer to median (more robust). Must be a finite positive number. (default 1.345 = canonical 95% ARE at normal)',
    '1.345',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'huber-desc' (default) | 'huber-asc' | 'mean-desc' | 'median-desc' | 'mean-gap-desc' (|huberMeanGap| desc) | 'median-gap-desc' (|huberMedianGap| desc) | 'rows' | 'source'",
    'huber-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minHuber: string;
        cTuning: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        const minHuber = Number.parseFloat(opts.minHuber);
        if (!Number.isFinite(minHuber) || minHuber < 0) {
          throw new Error(
            `--min-huber must be a finite, non-negative number (got ${opts.minHuber})`,
          );
        }
        const c = Number.parseFloat(opts.cTuning);
        if (!Number.isFinite(c) || !(c > 0)) {
          throw new Error(
            `--c-tuning must be a finite positive number (got ${opts.cTuning})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'huber-desc',
          'huber-asc',
          'mean-desc',
          'median-desc',
          'mean-gap-desc',
          'median-gap-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenMEstimatorHuber(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minHuber,
          c,
          top,
          sort: opts.sort as
            | 'huber-desc'
            | 'huber-asc'
            | 'mean-desc'
            | 'median-desc'
            | 'mean-gap-desc'
            | 'median-gap-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRowTokenMEstimatorHuber(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-m-estimator-tukey')
  .description(
    "Per-source Tukey biweight (bisquare) M-estimator of location of per-row total_tokens. Solves sum_i psi_c((x_i - mu)/s) = 0 by IRLS with mu_0 = median, s = MAD/0.6745, psi_c(z) = z*(1-(z/c)^2)^2 if |z|<=c else 0, c = 4.685 (canonical: ~95% asymptotic relative efficiency at the normal). FIRST REDESCENDING M-ESTIMATOR in the suite -- rows with |z|>c contribute exactly 0 (fully rejected, not merely clipped). Mechanically distinct from Huber (monotone psi: bounded but nonzero tail influence at +-c*s), distinct from L-estimators (mean / TM / WM / median / midhinge / trimean / IQM / HD broadened median: rank-only weights), distinct from R-estimators (Hodges-Lehmann), distinct from power means (Lehmer / harmonic / contraharmonic / quadratic). Translation- and scale-equivariant. Reports rejectedRows (rows with |z|>c at converged mu, weight = 0), iterations (IRLS step count), tukeyMeanGap = tukey - mean, tukeyMedianGap = tukey - median.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; must be an integer >= 4 (default 4)',
    '4',
  )
  .option(
    '--min-tukey <f>',
    'drop sources whose Tukey M-estimate is strictly below f; cohort selector. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--c-tuning <f>',
    'Tukey biweight tuning constant c. Larger c -> closer to mean (less robust); smaller c -> more aggressive rejection. Must be a finite positive number. (default 4.685 = canonical 95% ARE at normal)',
    '4.685',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'tukey-desc' (default) | 'tukey-asc' | 'mean-desc' | 'median-desc' | 'mean-gap-desc' (|tukeyMeanGap| desc) | 'median-gap-desc' (|tukeyMedianGap| desc) | 'rows' | 'source'",
    'tukey-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minTukey: string;
        cTuning: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        const minTukey = Number.parseFloat(opts.minTukey);
        if (!Number.isFinite(minTukey) || minTukey < 0) {
          throw new Error(
            `--min-tukey must be a finite, non-negative number (got ${opts.minTukey})`,
          );
        }
        const c = Number.parseFloat(opts.cTuning);
        if (!Number.isFinite(c) || !(c > 0)) {
          throw new Error(
            `--c-tuning must be a finite positive number (got ${opts.cTuning})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'tukey-desc',
          'tukey-asc',
          'mean-desc',
          'median-desc',
          'mean-gap-desc',
          'median-gap-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenMEstimatorTukey(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minTukey,
          c,
          top,
          sort: opts.sort as
            | 'tukey-desc'
            | 'tukey-asc'
            | 'mean-desc'
            | 'median-desc'
            | 'mean-gap-desc'
            | 'median-gap-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRowTokenMEstimatorTukey(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-m-estimator-hampel')
  .description(
    "Per-source Hampel three-part redescending M-estimator of location of per-row total_tokens. Solves sum_i psi(z) = 0 by IRLS with mu_0 = median, s = MAD/0.6745, and the piecewise-linear influence function psi(z) = z if |z|<=a; a*sign(z) if a<|z|<=b; a*sign(z)*(c-|z|)/(c-b) if b<|z|<=c; 0 if |z|>c. Canonical knots (a,b,c) = (1.7, 3.4, 8.5) -> ~95% asymptotic relative efficiency at the normal. FIRST PIECEWISE-LINEAR REDESCENDER and FIRST THREE-PART M-estimator in the suite. Mechanically distinct from Huber (monotone psi: clips to +-c forever, never zeroes out), distinct from Tukey biweight (smooth degree-4 single-knob redescender: tangent to zero at +-c, no inner plateau), distinct from L-estimators (rank-only weights), R-estimators (Hodges-Lehmann), and power means (Lehmer / harmonic / contraharmonic / quadratic). Translation- and scale-equivariant. Reports the FOUR-BUCKET residual partition: coreRows (|z|<=a, full weight 1), plateauRows (a<|z|<=b, psi plateau at a), descendingRows (b<|z|<=c, linear descent), rejectedRows (|z|>c, weight = 0). hampelMeanGap = hampel - mean, hampelMedianGap = hampel - median.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; must be an integer >= 4 (default 4)',
    '4',
  )
  .option(
    '--min-hampel <f>',
    'drop sources whose Hampel M-estimate is strictly below f; cohort selector. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--knot-a <f>',
    'Hampel inner knot a (in MAD units). Must satisfy 0 < a < b < c. (default 1.7 = canonical)',
    '1.7',
  )
  .option(
    '--knot-b <f>',
    'Hampel middle knot b (in MAD units). Must satisfy 0 < a < b < c. (default 3.4 = canonical)',
    '3.4',
  )
  .option(
    '--knot-c <f>',
    'Hampel outer knot c (in MAD units). Rows with |z| > c are fully rejected. Must satisfy 0 < a < b < c. (default 8.5 = canonical)',
    '8.5',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'hampel-desc' (default) | 'hampel-asc' | 'mean-desc' | 'median-desc' | 'mean-gap-desc' (|hampelMeanGap| desc) | 'median-gap-desc' (|hampelMedianGap| desc) | 'rejected-desc' (rejectedRows desc) | 'rows' | 'source'",
    'hampel-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minHampel: string;
        knotA: string;
        knotB: string;
        knotC: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        const minHampel = Number.parseFloat(opts.minHampel);
        if (!Number.isFinite(minHampel) || minHampel < 0) {
          throw new Error(
            `--min-hampel must be a finite, non-negative number (got ${opts.minHampel})`,
          );
        }
        const a = Number.parseFloat(opts.knotA);
        const b = Number.parseFloat(opts.knotB);
        const c = Number.parseFloat(opts.knotC);
        if (
          !Number.isFinite(a) ||
          !Number.isFinite(b) ||
          !Number.isFinite(c) ||
          !(a > 0) ||
          !(b > a) ||
          !(c > b)
        ) {
          throw new Error(
            `Hampel knots must satisfy 0 < a < b < c (got a=${opts.knotA}, b=${opts.knotB}, c=${opts.knotC})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'hampel-desc',
          'hampel-asc',
          'mean-desc',
          'median-desc',
          'mean-gap-desc',
          'median-gap-desc',
          'rejected-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenMEstimatorHampel(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minHampel,
          a,
          b,
          c,
          top,
          sort: opts.sort as
            | 'hampel-desc'
            | 'hampel-asc'
            | 'mean-desc'
            | 'median-desc'
            | 'mean-gap-desc'
            | 'median-gap-desc'
            | 'rejected-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRowTokenMEstimatorHampel(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-m-estimator-andrews')
  .description(
    "Per-source Andrews sine redescending M-estimator of location of per-row total_tokens. Solves sum_i psi(z) = 0 by IRLS with mu_0 = median, s = MAD/0.6745, and the SINUSOIDAL influence function psi(z) = A*sin(z/A) if |z| <= A*pi; 0 if |z| > A*pi. Canonical tuning A = 1.339 -> ~95% asymptotic relative efficiency at the normal. FIRST SINUSOIDAL/TRANSCENDENTAL REDESCENDER in the suite. Mechanically distinct from Huber (monotone psi: clips to +-c forever, never zeroes out), Tukey biweight (smooth degree-3 polynomial redescender), Hampel (piecewise-linear three-part with inner plateau), and from all L-estimators (rank-only weights) and power means (weighted by power of x itself, not residual). Translation- and scale-equivariant. Reports the THREE-BUCKET residual partition: coreRows (|z| <= A*pi/2, rising half of sine arch), descendingRows (A*pi/2 < |z| <= A*pi, falling half of sine arch), rejectedRows (|z| > A*pi, weight = 0). andrewsMeanGap = andrews - mean, andrewsMedianGap = andrews - median.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; must be an integer >= 4 (default 4)',
    '4',
  )
  .option(
    '--min-andrews <f>',
    'drop sources whose Andrews M-estimate is strictly below f; cohort selector. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--tuning <f>',
    'Andrews tuning constant A (in MAD units). Rows with |z| > A*pi are fully rejected. Must be > 0. (default 1.339 = canonical, ~95% ARE at the normal)',
    '1.339',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'andrews-desc' (default) | 'andrews-asc' | 'mean-desc' | 'median-desc' | 'mean-gap-desc' (|andrewsMeanGap| desc) | 'median-gap-desc' (|andrewsMedianGap| desc) | 'rejected-desc' (rejectedRows desc) | 'rows' | 'source'",
    'andrews-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minAndrews: string;
        tuning: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        const minAndrews = Number.parseFloat(opts.minAndrews);
        if (!Number.isFinite(minAndrews) || minAndrews < 0) {
          throw new Error(
            `--min-andrews must be a finite, non-negative number (got ${opts.minAndrews})`,
          );
        }
        const tuning = Number.parseFloat(opts.tuning);
        if (!Number.isFinite(tuning) || !(tuning > 0)) {
          throw new Error(
            `--tuning must be a positive finite number (got ${opts.tuning})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'andrews-desc',
          'andrews-asc',
          'mean-desc',
          'median-desc',
          'mean-gap-desc',
          'median-gap-desc',
          'rejected-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenMEstimatorAndrews(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minAndrews,
          tuning,
          top,
          sort: opts.sort as
            | 'andrews-desc'
            | 'andrews-asc'
            | 'mean-desc'
            | 'median-desc'
            | 'mean-gap-desc'
            | 'median-gap-desc'
            | 'rejected-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRowTokenMEstimatorAndrews(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-m-estimator-welsch')
  .description(
    "Per-source Welsch (Leclerc) Gaussian-kernel redescending M-estimator of location of per-row total_tokens. Solves sum_i psi(z) = 0 by IRLS with mu_0 = median, s = MAD/0.6745, and the GAUSSIAN influence function psi(z) = z * exp(-(z/c)^2/2). Canonical tuning c = 2.9846 -> ~95% asymptotic relative efficiency at the normal. FIRST GAUSSIAN-KERNEL REDESCENDER and FIRST INFINITE-SUPPORT REDESCENDER in the suite: weight w(z) = exp(-(z/c)^2/2) is strictly positive for every finite z (no hard rejection cliff). Mechanically distinct from Huber (monotone, never redescends), Tukey biweight (smooth degree-3 polynomial with COMPACT support), Hampel (piecewise-linear three-part with hard outer cutoff at 8.5 MAD-units), and Andrews sine (transcendental sine wave with COMPACT support at A*pi). Translation- and scale-equivariant. Reports a THREE-BUCKET residual partition keyed on WEIGHT MAGNITUDE (no other shipped M-estimator partitions on weight, since they all hit a support cutoff first): coreRows (weight >= 0.5, |z| <= c*sqrt(2 ln 2) ~ 2.484), descendingRows (0.01 <= weight < 0.5), negligibleRows (weight < 0.01, |z| > c*sqrt(2 ln 100) ~ 9.05; effectively rejected but never exactly w = 0). welschMeanGap = welsch - mean, welschMedianGap = welsch - median.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; must be an integer >= 4 (default 4)',
    '4',
  )
  .option(
    '--min-welsch <f>',
    'drop sources whose Welsch M-estimate is strictly below f; cohort selector. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--tuning <f>',
    'Welsch tuning constant c (in MAD units). Weight = exp(-(z/c)^2/2); never exactly zero. Must be > 0. (default 2.9846 = canonical, ~95% ARE at the normal)',
    '2.9846',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'welsch-desc' (default) | 'welsch-asc' | 'mean-desc' | 'median-desc' | 'mean-gap-desc' (|welschMeanGap| desc) | 'median-gap-desc' (|welschMedianGap| desc) | 'negligible-desc' (negligibleRows desc) | 'rows' | 'source'",
    'welsch-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minWelsch: string;
        tuning: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        const minWelsch = Number.parseFloat(opts.minWelsch);
        if (!Number.isFinite(minWelsch) || minWelsch < 0) {
          throw new Error(
            `--min-welsch must be a finite, non-negative number (got ${opts.minWelsch})`,
          );
        }
        const tuning = Number.parseFloat(opts.tuning);
        if (!Number.isFinite(tuning) || !(tuning > 0)) {
          throw new Error(
            `--tuning must be a positive finite number (got ${opts.tuning})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'welsch-desc',
          'welsch-asc',
          'mean-desc',
          'median-desc',
          'mean-gap-desc',
          'median-gap-desc',
          'negligible-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenMEstimatorWelsch(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minWelsch,
          tuning,
          top,
          sort: opts.sort as
            | 'welsch-desc'
            | 'welsch-asc'
            | 'mean-desc'
            | 'median-desc'
            | 'mean-gap-desc'
            | 'median-gap-desc'
            | 'negligible-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRowTokenMEstimatorWelsch(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-m-estimator-cauchy')
  .description(
    "Per-source Cauchy (Lorentzian) M-estimator of location of per-row total_tokens. Solves sum_i psi(z) = 0 by IRLS with mu_0 = median, s = MAD/0.6745, and the CAUCHY influence function psi(z) = z / (1 + (z/c)^2). Canonical tuning c = 2.3849 -> ~95% asymptotic relative efficiency at the normal. ROUNDS OUT M-ESTIMATOR COVERAGE: the only MONOTONE M-estimator with VANISHING TAIL INFLUENCE in the suite. Mechanically distinct from Huber (monotone but psi clips to constant +/- c forever -- bounded but constant nonzero tail), Tukey biweight (smooth polynomial with COMPACT support), Hampel (piecewise-linear three-part with hard outer cutoff), Andrews sine (sinusoidal with COMPACT support), and Welsch (Gaussian-kernel REDESCENDER with infinite support). Cauchy psi is monotone and infinite-support, with tail influence decaying like c^2/z (never increases past a peak, never reaches zero, never reaches a constant plateau). Reports a three-bucket residual partition keyed on WEIGHT MAGNITUDE: coreRows (w >= 0.5, |z| <= c -- the half-power knee), tailRows (0.05 <= w < 0.5, c < |z| <= c*sqrt(19) ~ 4.36c), farTailRows (w < 0.05, |z| > c*sqrt(19); very small but strictly positive -- Cauchy never assigns w = 0 to a finite z). cauchyMeanGap = cauchy - mean, cauchyMedianGap = cauchy - median.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; must be an integer >= 4 (default 4)',
    '4',
  )
  .option(
    '--min-cauchy <f>',
    'drop sources whose Cauchy M-estimate is strictly below f; cohort selector. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--tuning <f>',
    'Cauchy/Lorentzian tuning constant c (in MAD units). Weight = 1 / (1 + (z/c)^2); never exactly zero for finite z. Must be > 0. (default 2.3849 = canonical, ~95% ARE at the normal)',
    '2.3849',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'cauchy-desc' (default) | 'cauchy-asc' | 'mean-desc' | 'median-desc' | 'mean-gap-desc' (|cauchyMeanGap| desc) | 'median-gap-desc' (|cauchyMedianGap| desc) | 'far-tail-desc' (farTailRows desc) | 'rows' | 'source'",
    'cauchy-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minCauchy: string;
        tuning: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        const minCauchy = Number.parseFloat(opts.minCauchy);
        if (!Number.isFinite(minCauchy) || minCauchy < 0) {
          throw new Error(
            `--min-cauchy must be a finite, non-negative number (got ${opts.minCauchy})`,
          );
        }
        const tuning = Number.parseFloat(opts.tuning);
        if (!Number.isFinite(tuning) || !(tuning > 0)) {
          throw new Error(
            `--tuning must be a positive finite number (got ${opts.tuning})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'cauchy-desc',
          'cauchy-asc',
          'mean-desc',
          'median-desc',
          'mean-gap-desc',
          'median-gap-desc',
          'far-tail-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenMEstimatorCauchy(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minCauchy,
          tuning,
          top,
          sort: opts.sort as
            | 'cauchy-desc'
            | 'cauchy-asc'
            | 'mean-desc'
            | 'median-desc'
            | 'mean-gap-desc'
            | 'median-gap-desc'
            | 'far-tail-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRowTokenMEstimatorCauchy(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-m-estimator-geman-mcclure')
  .description(
    "Per-source Geman-McClure REDESCENDING M-estimator of location of per-row total_tokens. PARAMETER-FREE: rho_GM(z) = z^2/(1+z^2), psi_GM(z) = 2z/(1+z^2)^2, weight w(z) = 2/(1+z^2)^2 — no tuning constant required. IRLS with mu_0 = median, s = MAD/0.6745. First REDESCENDER WITH POLYNOMIAL (~1/z^4) TAIL DECAY in the suite, sitting between Cauchy (v0.6.215, monotone, 1/z^2 tail) and Tukey biweight (v0.6.208, redescender, COMPACT support). Distinct from Welsch (v0.6.213, redescender with EXPONENTIAL exp(-(z/c)^2) tail) — Geman-McClure tail is polynomial, not exponential. Reports a three-bucket residual partition keyed on WEIGHT MAGNITUDE (peak weight w(0) = 2): coreRows (w >= 1, |z| <= 0.6436 — the half-peak knee), tailRows (0.05 <= w < 1, 0.6436 < |z| <= ~2.299), farTailRows (w < 0.05, |z| > 2.299; very small but strictly positive — Geman-McClure never assigns w = 0 to a finite z). gemanMeanGap = geman - mean, gemanMedianGap = geman - median, gemanMedianRatio = geman / median.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; must be an integer >= 4 (default 4)',
    '4',
  )
  .option(
    '--min-geman <f>',
    'drop sources whose Geman-McClure M-estimate is strictly below f; cohort selector. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'geman-desc' (default) | 'geman-asc' | 'mean-desc' | 'median-desc' | 'mean-gap-desc' (|gemanMeanGap| desc) | 'median-gap-desc' (|gemanMedianGap| desc) | 'far-tail-desc' (farTailRows desc) | 'core-share-desc' (coreRows/rowsKept desc) | 'far-tail-share-desc' (farTailRows/rowsKept desc) | 'rows' | 'source'",
    'geman-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minGeman: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        const minGeman = Number.parseFloat(opts.minGeman);
        if (!Number.isFinite(minGeman) || minGeman < 0) {
          throw new Error(
            `--min-geman must be a finite, non-negative number (got ${opts.minGeman})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'geman-desc',
          'geman-asc',
          'mean-desc',
          'median-desc',
          'mean-gap-desc',
          'median-gap-desc',
          'far-tail-desc',
          'core-share-desc',
          'far-tail-share-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenMEstimatorGemanMcClure(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minGeman,
          top,
          sort: opts.sort as
            | 'geman-desc'
            | 'geman-asc'
            | 'mean-desc'
            | 'median-desc'
            | 'mean-gap-desc'
            | 'median-gap-desc'
            | 'far-tail-desc'
            | 'core-share-desc'
            | 'far-tail-share-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenMEstimatorGemanMcClure(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-theil-sen-slope')
  .description(
    "Per-source Theil-Sen median pairwise slope of per-row total_tokens against row index, in tokens per row. R-estimator: enumerate C(n,2) pairwise slopes (x_j - x_i)/(j - i) for i < j and take their median; intercept = median_i(x_i - slope*i). Asymptotic breakdown ~29.3 percent — robust to ~3 in 10 outlier rows. FIRST ROBUST PAIRWISE-SLOPE TREND lens, FIRST PER-ROW (not per-day) trend slope, and the non-parametric POINT ESTIMATOR sibling to source-row-token-mann-kendall-trend (which gives the test, not the magnitude). Distinct from the OLS source-daily-token-trend-slope (least squares on daily aggregates, breakdown 0%) and from every M-estimator location lens (those find a robust center, not a slope). Reports a unique three-bucket pair partition keyed on the SIGN of each pairwise slope: pairsPositive (s > 0), pairsNegative (s < 0), pairsZero (s == 0); pairsPositive + pairsNegative + pairsZero = n*(n-1)/2 and (pairsPositive - pairsNegative) is exactly the sign-resolved Mann-Kendall S statistic. naiveSlope = (lastX - firstX)/(n-1) is the non-robust endpoint reference.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; must be an integer >= 4 (default 4)',
    '4',
  )
  .option(
    '--min-slope-magnitude <f>',
    'drop sources whose |slope| is strictly below f; cohort selector. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--max-pairs <n>',
    'skip sources whose pair count n*(n-1)/2 exceeds n; bounds the O(n^2) memory of the pairwise enumeration. Must be a positive integer. (default 5000000 ~ n=3162 rows)',
    '5000000',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'magnitude-desc' (default; |slope| desc) | 'slope-desc' | 'slope-asc' | 'positive-desc' (pairsPositive desc) | 'negative-desc' (pairsNegative desc) | 'rows' | 'source'",
    'magnitude-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minSlopeMagnitude: string;
        maxPairs: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        const minSlopeMagnitude = Number.parseFloat(opts.minSlopeMagnitude);
        if (!Number.isFinite(minSlopeMagnitude) || minSlopeMagnitude < 0) {
          throw new Error(
            `--min-slope-magnitude must be a finite, non-negative number (got ${opts.minSlopeMagnitude})`,
          );
        }
        const maxPairs = Number.parseInt(opts.maxPairs, 10);
        if (!Number.isInteger(maxPairs) || maxPairs < 1) {
          throw new Error(
            `--max-pairs must be a positive integer (got ${opts.maxPairs})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'slope-desc',
          'slope-asc',
          'magnitude-desc',
          'positive-desc',
          'negative-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenTheilSenSlope(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minSlopeMagnitude,
          maxPairs,
          top,
          sort: opts.sort as
            | 'slope-desc'
            | 'slope-asc'
            | 'magnitude-desc'
            | 'positive-desc'
            | 'negative-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
           process.stdout.write(renderSourceRowTokenTheilSenSlope(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );


program
  .command('source-row-token-siegel-slope')
  .description(
    "Per-source Siegel REPEATED-MEDIANS slope of per-row total_tokens against row index, in tokens per row. R-estimator with NESTED MEDIANS: per anchor i compute m_i = median_{j != i} (x_j - x_i)/(j - i); then slope = median_i(m_i); intercept = median_i(x_i - slope*i). Asymptotic breakdown ~50% — the MAXIMAL breakdown for any equivariant slope estimator, vs Theil-Sen ~29.3%. FIRST ~50% BREAKDOWN slope estimator and FIRST NESTED-MEDIAN estimator in the suite. Distinct from the OLS source-daily-token-trend-slope (least squares, breakdown 0%) and from every M-estimator location lens (those find a robust center, not a slope). Reports per-anchor median spread (perAnchorMedianMin/Max/Range): wide range -> trend is heterogeneous across anchors; narrow range -> trend is locally consistent. Anchor counts (anchorsPositive/Negative/Zero) sum to n. naiveSlope = (lastX - firstX)/(n-1) is the non-robust endpoint reference.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; must be an integer >= 4 (default 4)',
    '4',
  )
  .option(
    '--min-slope-magnitude <f>',
    'drop sources whose |slope| is strictly below f; cohort selector. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--max-pairs <n>',
    'skip sources whose ordered slope count n*(n-1) exceeds n; bounds the O(n^2) work. Must be a positive integer. (default 5000000 ~ n=2236 rows)',
    '5000000',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'magnitude-desc' (default; |slope| desc) | 'slope-desc' | 'slope-asc' | 'range-desc' (perAnchorMedianRange desc) | 'agreement-desc' (anchorAgreement desc; how unanimous anchors are about trend direction) | 'positive-desc' (anchorsPositive desc) | 'negative-desc' (anchorsNegative desc) | 'rows' | 'source'",
    'magnitude-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minSlopeMagnitude: string;
        maxPairs: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        const minSlopeMagnitude = Number.parseFloat(opts.minSlopeMagnitude);
        if (!Number.isFinite(minSlopeMagnitude) || minSlopeMagnitude < 0) {
          throw new Error(
            `--min-slope-magnitude must be a finite, non-negative number (got ${opts.minSlopeMagnitude})`,
          );
        }
        const maxPairs = Number.parseInt(opts.maxPairs, 10);
        if (!Number.isInteger(maxPairs) || maxPairs < 1) {
          throw new Error(
            `--max-pairs must be a positive integer (got ${opts.maxPairs})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'slope-desc',
          'slope-asc',
          'magnitude-desc',
          'range-desc',
          'agreement-desc',
          'positive-desc',
          'negative-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenSiegelSlope(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minSlopeMagnitude,
          maxPairs,
          top,
          sort: opts.sort as
            | 'slope-desc'
            | 'slope-asc'
            | 'magnitude-desc'
            | 'range-desc'
            | 'agreement-desc'
            | 'positive-desc'
            | 'negative-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRowTokenSiegelSlope(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );


program
  .command('source-row-token-passing-bablok-slope')
  .description(
    "Per-source Passing-Bablok shifted-median slope of per-row total_tokens against row index, in tokens per row. Errors-in-both-variables R-estimator (Passing & Bablok 1983): enumerate all n*(n-1)/2 pairwise slopes, drop any s == -1, let K = #{s < -1}, then pick the slope at sorted 1-based position floor((N+1)/2) + K (lower pick when (N-K) is even). FIRST x<->y SYMMETRIC slope estimator in the suite — PB returns reciprocal slopes when you swap regressor and regressand, while Theil-Sen / Siegel do not. Asymptotic breakdown ~29.3%, same as Theil-Sen. Reports the explicit shift (pairsBelowMinusOne K, shiftIndex, shiftRatio) and pbVsTheilSenGap = slope - theilSenSlope so you can see how far PB has moved from the unshifted reference. Originally for clinical-chemistry method comparison; now the canonical robust regression for errors-in-both-variables data.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; must be an integer >= 4 (default 4)',
    '4',
  )
  .option(
    '--min-slope-magnitude <f>',
    'drop sources whose |slope| is strictly below f; cohort selector. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--max-pairs <n>',
    'skip sources whose pair count n*(n-1)/2 exceeds n; bounds the O(n^2) work. Must be a positive integer. (default 5000000 ~ n=3163 rows)',
    '5000000',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'magnitude-desc' (default; |slope| desc) | 'slope-desc' | 'slope-asc' | 'gap-desc' (pbVsTheilSenGap desc) | 'gap-magnitude-desc' (|pbVsTheilSenGap| desc) | 'shift-ratio-desc' (shiftIndex/N desc) | 'naive-gap-magnitude-desc' (|pbVsNaiveGap| desc) | 'sign-flipped-first' (signFlippedFromNaive=true first) | 'rows' | 'source'",
    'magnitude-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minSlopeMagnitude: string;
        maxPairs: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        const minSlopeMagnitude = Number.parseFloat(opts.minSlopeMagnitude);
        if (!Number.isFinite(minSlopeMagnitude) || minSlopeMagnitude < 0) {
          throw new Error(
            `--min-slope-magnitude must be a finite, non-negative number (got ${opts.minSlopeMagnitude})`,
          );
        }
        const maxPairs = Number.parseInt(opts.maxPairs, 10);
        if (!Number.isInteger(maxPairs) || maxPairs < 1) {
          throw new Error(
            `--max-pairs must be a positive integer (got ${opts.maxPairs})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'slope-desc',
          'slope-asc',
          'magnitude-desc',
          'gap-desc',
          'gap-magnitude-desc',
          'shift-ratio-desc',
          'naive-gap-magnitude-desc',
          'sign-flipped-first',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenPassingBablokSlope(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minSlopeMagnitude,
          maxPairs,
          top,
          sort: opts.sort as
            | 'slope-desc'
            | 'slope-asc'
            | 'magnitude-desc'
            | 'gap-desc'
            | 'gap-magnitude-desc'
            | 'shift-ratio-desc'
            | 'naive-gap-magnitude-desc'
            | 'sign-flipped-first'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRowTokenPassingBablokSlope(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-deming-slope')
  .description(
    "Per-source Deming regression slope of per-row total_tokens against row index, in tokens per row. Parametric maximum-likelihood errors-in-both-variables (EIV) regression under bivariate normal noise with variance ratio lambda = var(eps_y)/var(eps_x). Closed form: b = (s_yy - lambda*s_xx + sqrt((s_yy - lambda*s_xx)^2 + 4*lambda*s_xy^2)) / (2*s_xy). Lambda = 1 (default) gives orthogonal regression — x<->y SYMMETRIC. Lambda -> 0 collapses to OLS (the index axis is exact); lambda -> infinity to OLS-of-x-on-y. Parametric SIBLING of source-row-token-passing-bablok-slope (v0.6.218, non-parametric EIV R-estimator): same EIV target, opposite assumption stance — Deming is closed-form MLE, 0% breakdown, with a tunable lambda; PB is shifted-median, ~29.3% breakdown, no distribution. Reports olsSlope (lambda->0 limit), demingVsOlsGap, demingVsNaiveGap, and a lambda-sensitivity diagnostic — slope re-evaluated at lambda/2 and lambda*2 — so you can see how much the answer depends on the assumed variance ratio. Originally Deming (1943).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; must be an integer >= 4 (default 4)',
    '4',
  )
  .option(
    '--min-slope-magnitude <f>',
    'drop sources whose |slope| is strictly below f; cohort selector. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--lambda <f>',
    'variance ratio var(eps_y)/var(eps_x); must be a finite, strictly positive number. lambda=1 is orthogonal regression (x<->y symmetric); lambda->0 is OLS. (default 1)',
    '1',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'magnitude-desc' (default; |slope| desc) | 'slope-desc' | 'slope-asc' | 'gap-desc' (demingVsOlsGap desc) | 'gap-magnitude-desc' (|demingVsOlsGap| desc) | 'naive-gap-magnitude-desc' (|demingVsNaiveGap| desc) | 'lambda-sensitivity-desc' (|lambdaSensitivity| desc) | 'lambda-sensitivity-relative-desc' (|lambdaSensitivity/slope| desc) | 'sign-flipped-from-ols-first' (signFlippedFromOls=true first) | 'rows' | 'source'",
    'magnitude-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minSlopeMagnitude: string;
        lambda: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        const minSlopeMagnitude = Number.parseFloat(opts.minSlopeMagnitude);
        if (!Number.isFinite(minSlopeMagnitude) || minSlopeMagnitude < 0) {
          throw new Error(
            `--min-slope-magnitude must be a finite, non-negative number (got ${opts.minSlopeMagnitude})`,
          );
        }
        const lambda = Number.parseFloat(opts.lambda);
        if (!Number.isFinite(lambda) || lambda <= 0) {
          throw new Error(
            `--lambda must be a finite, strictly positive number (got ${opts.lambda})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'slope-desc',
          'slope-asc',
          'magnitude-desc',
          'gap-desc',
          'gap-magnitude-desc',
          'naive-gap-magnitude-desc',
          'lambda-sensitivity-desc',
          'lambda-sensitivity-relative-desc',
          'sign-flipped-from-ols-first',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenDemingSlope(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minSlopeMagnitude,
          lambda,
          top,
          sort: opts.sort as
            | 'slope-desc'
            | 'slope-asc'
            | 'magnitude-desc'
            | 'gap-desc'
            | 'gap-magnitude-desc'
            | 'naive-gap-magnitude-desc'
            | 'lambda-sensitivity-desc'
            | 'lambda-sensitivity-relative-desc'
            | 'sign-flipped-from-ols-first'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRowTokenDemingSlope(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );


program
  .command('source-row-token-bootstrap-slope-ci')
  .description(
    "Per-source non-parametric bootstrap percentile CI for the Deming regression slope of per-row total_tokens against row index. First uncertainty-quantification lens in the slope suite (every prior slope lens is a point estimator). Resamples n indices with replacement B times under a seeded LCG (Numerical Recipes 32-bit), refits Deming on each, returns slope (full-data point), bootMean, bootStd, ciLower/ciUpper at the requested confidence (default 0.95), ciWidth, and ciContainsZero (true iff the CI straddles zero — i.e. the slope is not statistically distinguishable from zero under the bootstrap). Use --alert-zero-in-ci to filter to only sources whose CI straddles zero.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; integer >= 4 (default 4)',
    '4',
  )
  .option(
    '--bootstraps <n>',
    'number of bootstrap resamples; integer >= 100 (default 1000)',
    '1000',
  )
  .option(
    '--confidence <f>',
    'confidence level in (0, 1) (default 0.95)',
    '0.95',
  )
  .option(
    '--lambda <f>',
    'variance ratio var(eps_y)/var(eps_x) for inner Deming fit; finite > 0 (default 1)',
    '1',
  )
  .option(
    '--seed <n>',
    'integer seed for the LCG bootstrap RNG (default 42)',
    '42',
  )
  .option(
    '--alert-zero-in-ci',
    'only emit sources whose CI strictly contains zero (i.e. slope not significantly different from zero)',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'magnitude-desc' (default; |slope| desc) | 'slope-desc' | 'slope-asc' | 'ci-width-desc' | 'ci-width-asc' | 'boot-std-desc' | 'ci-contains-zero-first' | 'boot-skew-magnitude-desc' | 'rows' | 'source'",
    'magnitude-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        bootstraps: string;
        confidence: string;
        lambda: string;
        seed: string;
        alertZeroInCi?: boolean;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        const bootstraps = Number.parseInt(opts.bootstraps, 10);
        if (!Number.isInteger(bootstraps) || bootstraps < 100) {
          throw new Error(
            `--bootstraps must be an integer >= 100 (got ${opts.bootstraps})`,
          );
        }
        const confidence = Number.parseFloat(opts.confidence);
        if (
          !Number.isFinite(confidence) ||
          confidence <= 0 ||
          confidence >= 1
        ) {
          throw new Error(
            `--confidence must be a finite number in (0, 1) (got ${opts.confidence})`,
          );
        }
        const lambda = Number.parseFloat(opts.lambda);
        if (!Number.isFinite(lambda) || lambda <= 0) {
          throw new Error(
            `--lambda must be a finite, strictly positive number (got ${opts.lambda})`,
          );
        }
        const seed = Number.parseInt(opts.seed, 10);
        if (!Number.isInteger(seed)) {
          throw new Error(
            `--seed must be an integer (got ${opts.seed})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'magnitude-desc',
          'slope-desc',
          'slope-asc',
          'ci-width-desc',
          'ci-width-asc',
          'boot-std-desc',
          'ci-contains-zero-first',
          'boot-skew-magnitude-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenBootstrapSlopeCi(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          bootstraps,
          confidence,
          lambda,
          seed,
          alertZeroInCi: opts.alertZeroInCi ?? false,
          top,
          sort: opts.sort as
            | 'magnitude-desc'
            | 'slope-desc'
            | 'slope-asc'
            | 'ci-width-desc'
            | 'ci-width-asc'
            | 'boot-std-desc'
            | 'ci-contains-zero-first'
            | 'boot-skew-magnitude-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenBootstrapSlopeCi(report) + '\n',
          );
        }
      } catch (e) {
         die(e);
      }
    },
  );


program
  .command('source-row-token-jackknife-slope-ci')
  .description(
    "Per-source jackknife (leave-one-out) confidence interval for the Deming regression slope of per-row total_tokens against row index. Sibling to the v0.6.220 bootstrap-slope-CI lens, mechanically distinct: deterministic leave-one-out resampling (no RNG, no seed) instead of with-replacement bootstrap, classical jackknife SE = sqrt(((n-1)/n)*sum (theta_(-i) - jackMean)^2), Quenouille-Tukey bias = (n-1)*(jackMean - thetaFull), bias-corrected slope = thetaFull - bias, and a NORMAL-APPROXIMATION CI = biasCorrected +/- z*jackSe (vs the bootstrap's percentile CI). Uniquely produces a bias estimate the bootstrap doesn't. Use --alert-zero-in-ci to filter to only sources whose CI straddles zero.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; integer >= 4 (default 4)',
    '4',
  )
  .option(
    '--confidence <f>',
    'confidence level in (0, 1) (default 0.95)',
    '0.95',
  )
  .option(
    '--lambda <f>',
    'variance ratio var(eps_y)/var(eps_x) for inner Deming fit; finite > 0 (default 1)',
    '1',
  )
  .option(
    '--alert-zero-in-ci',
    'only emit sources whose CI strictly contains zero (i.e. slope not significantly different from zero under the jackknife normal-approximation CI)',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'magnitude-desc' (default; |slope| desc) | 'slope-desc' | 'slope-asc' | 'ci-width-desc' | 'ci-width-asc' | 'jack-se-desc' | 'bias-magnitude-desc' | 'ci-contains-zero-first' | 'rows' | 'source'",
    'magnitude-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        confidence: string;
        lambda: string;
        alertZeroInCi?: boolean;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        const confidence = Number.parseFloat(opts.confidence);
        if (
          !Number.isFinite(confidence) ||
          confidence <= 0 ||
          confidence >= 1
        ) {
          throw new Error(
            `--confidence must be a finite number in (0, 1) (got ${opts.confidence})`,
          );
        }
        const lambda = Number.parseFloat(opts.lambda);
        if (!Number.isFinite(lambda) || lambda <= 0) {
          throw new Error(
            `--lambda must be a finite, strictly positive number (got ${opts.lambda})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'magnitude-desc',
          'slope-desc',
          'slope-asc',
          'ci-width-desc',
          'ci-width-asc',
          'jack-se-desc',
          'bias-magnitude-desc',
          'ci-contains-zero-first',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenJackknifeSlopeCi(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          confidence,
          lambda,
          alertZeroInCi: opts.alertZeroInCi ?? false,
          top,
          sort: opts.sort as
            | 'magnitude-desc'
            | 'slope-desc'
            | 'slope-asc'
            | 'ci-width-desc'
            | 'ci-width-asc'
            | 'jack-se-desc'
            | 'bias-magnitude-desc'
            | 'ci-contains-zero-first'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenJackknifeSlopeCi(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );


program
  .description(
    "Per-source share of total token mass on the source's single biggest UTC day, plus top-2/top-3 cumulative shares and a per-day Herfindahl-Hirschman index. Detects sources whose history is dominated by a single date — orthogonal to daily-token-gini (global), source-day-of-week-token-mass-share (DOW modular), source-active-day-streak (run length), and source-token-mass-hour-centroid (location).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-days <n>',
    'drop sources with fewer than n active UTC days (default 3)',
    '3',
  )
  .option(
    '--max-share-min <f>',
    "drop sources whose maxDayShare is below f (in [0,1]); useful for surfacing only single-date-dominated sources, e.g. --max-share-min 0.4 keeps only sources whose biggest day is >= 40% of their entire history (default 0)",
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'tokens' (default) | 'maxshare' | 'top2' | 'top3' | 'hhi' | 'days' | 'source'",
    'tokens',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minDays: string;
        maxShareMin: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minDays = Number.parseInt(opts.minDays, 10);
        if (!Number.isInteger(minDays) || minDays < 1) {
          throw new Error(
            `--min-days must be a positive integer (got ${opts.minDays})`,
          );
        }
        const minMaxShare = Number.parseFloat(opts.maxShareMin);
        if (!Number.isFinite(minMaxShare) || minMaxShare < 0 || minMaxShare > 1) {
          throw new Error(
            `--max-share-min must be a finite number in [0, 1] (got ${opts.maxShareMin})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'tokens',
          'maxshare',
          'top2',
          'top3',
          'hhi',
          'days',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceSingleDayMassConcentration(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minDays,
          minMaxShare,
          top,
          sort: opts.sort as
            | 'tokens'
            | 'maxshare'
            | 'top2'
            | 'top3'
            | 'hhi'
            | 'days'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceSingleDayMassConcentration(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-cumulative-mass-half-life-day')
  .description(
    "Per-source smallest number of UTC days (sorted desc by token mass) whose cumulative share first crosses 50% (`halfLifeDays`), plus the same for 25% and 75% thresholds, plus halfLifeRatio = halfLifeDays/daysActive. A threshold-crossing index orthogonal to fixed-k shares (top1/top2/top3 in single-day-mass-concentration), sum-of-squares (HHI), pooled gini (daily-token-gini-coefficient), and chronological half-life (decay-half-life). Two sources can share top3Share but differ in halfLifeDays.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-days <n>',
    'drop sources with fewer than n active UTC days (default 2; half-life is degenerate at 1 day)',
    '2',
  )
  .option(
    '--max-half-days <n>',
    'drop sources whose absolute halfLifeDays exceeds n (positive integer); useful for surfacing only sources that reach the 50% mark within k days regardless of how long their full history runs (default no filter)',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'half' (default, asc) | 'ratio' (asc) | 'tokens' (desc) | 'days' (desc) | 'quartile' (asc) | 'threequarter' (asc) | 'source' (asc)",
    'half',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minDays: string;
        maxHalfDays?: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minDays = Number.parseInt(opts.minDays, 10);
        if (!Number.isInteger(minDays) || minDays < 1) {
          throw new Error(
            `--min-days must be a positive integer (got ${opts.minDays})`,
          );
        }
        let maxHalfLifeDays: number | null = null;
        if (opts.maxHalfDays != null) {
          const m = Number.parseFloat(opts.maxHalfDays);
          if (!Number.isFinite(m) || m < 1 || !Number.isInteger(m)) {
            throw new Error(
              `--max-half-days must be a positive integer (got ${opts.maxHalfDays})`,
            );
          }
          maxHalfLifeDays = m;
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'half',
          'ratio',
          'tokens',
          'days',
          'quartile',
          'threequarter',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceCumulativeMassHalfLifeDay(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minDays,
          maxHalfLifeDays,
          top,
          sort: opts.sort as
            | 'half'
            | 'ratio'
            | 'tokens'
            | 'days'
            | 'quartile'
            | 'threequarter'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceCumulativeMassHalfLifeDay(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('daily-token-second-difference-sign-runs')
  .description(
    "Per-source longest run of consecutive same-sign second differences of daily total tokens — concavity-regime persistence (concaveup = accelerating, concavedown = decelerating, flat = locally linear). Trajectory-curvature statistic orthogonal to monotone-run-length (velocity-sign), autocorrelation (mean-shape), and z-score-extremes (tail events).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--source <name>',
    'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter',
  )
  .option(
    '--min-days <n>',
    'hide source rows with fewer than n active calendar days (default 3, must be >= 3); counts surface as droppedSparseSources',
    '3',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sort; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    'sort key: tokens (default) | longest | concaveup | concavedown | flat | current | ndays | source. Applied before --top.',
    'tokens',
  )
  .option(
    '--min-current-run <n>',
    'display filter: hide sources whose currentRunLength is below n (the trailing same-sign d2 stretch). Useful for surfacing only sources sitting in a deeply persistent regime right now. Counts surface as droppedBelowMinCurrentRun. Default 0 = no floor.',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minDays: string;
        top: string;
        sort: string;
        minCurrentRun: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minDays = Number.parseInt(opts.minDays, 10);
        if (!Number.isInteger(minDays) || minDays < 3) {
          throw new Error(`--min-days must be an integer >= 3 (got ${opts.minDays})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const minCurrentRun = Number.parseInt(opts.minCurrentRun, 10);
        if (!Number.isInteger(minCurrentRun) || minCurrentRun < 0) {
          throw new Error(
            `--min-current-run must be a non-negative integer (got ${opts.minCurrentRun})`,
          );
        }
        const validSorts = [
          'tokens',
          'longest',
          'concaveup',
          'concavedown',
          'flat',
          'current',
          'ndays',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildDailyTokenSecondDiffSignRuns(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minDays,
          top,
          minCurrentRun,
          sort: opts.sort as
            | 'tokens'
            | 'longest'
            | 'concaveup'
            | 'concavedown'
            | 'flat'
            | 'current'
            | 'ndays'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderDailyTokenSecondDiffSignRuns(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-output-token-benford-deviation')
  .description(
    "Per-source goodness-of-fit of output_tokens leading-digit distribution to Benford's law (P(d)=log10(1+1/d)). Reports chi-square (8 d.o.f.) and Nigrini MAD%. Scale-free fingerprint of value-shape orthogonal to every magnitude/order statistic.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--source <name>',
    'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter',
  )
  .option(
    '--min-rows <n>',
    'hide source rows with fewer than n positive-output rows (default 30, must be >= 9); counts surface as droppedSparseSources',
    '30',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sort; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    'sort key: tokens (default) | mad | chi2 | rows | source. Applied before --top.',
    'tokens',
  )
  .option(
    '--max-mad <pct>',
    'display filter: hide sources whose MAD% strictly exceeds this value (default 0 = no filter). Useful for surfacing only sources that conform to Benford.',
    '0',
  )
  .option(
    '--require-d1-mode',
    "display filter: hide sources whose mode leading digit is not 1. Benford's most basic prediction is that d=1 dominates (~30.10%); a source with any other mode digit is structurally non-Benford regardless of MAD/chi2. Counts surface as droppedNonD1Mode. Default off.",
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        top: string;
        sort: string;
        maxMad: string;
        requireD1Mode?: boolean;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 9) {
          throw new Error(`--min-rows must be an integer >= 9 (got ${opts.minRows})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const maxMad = Number.parseFloat(opts.maxMad);
        if (!Number.isFinite(maxMad) || maxMad < 0) {
          throw new Error(
            `--max-mad must be a non-negative number (got ${opts.maxMad})`,
          );
        }
        const validSorts = ['tokens', 'mad', 'chi2', 'rows', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceOutputTokenBenfordDeviation(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          top,
          maxMad,
          requireD1Mode: opts.requireD1Mode === true,
          sort: opts.sort as 'tokens' | 'mad' | 'chi2' | 'rows' | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceOutputTokenBenfordDeviation(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-token-mass-hour-centroid')
  .description(
    'Per-source token-mass-weighted circular centroid on the 24-hour clock. Reports centroidHour, resultant length R (concentration), and circular SD in hours. Treats hour-of-day as circular (23 and 0 adjacent), unlike every other hour-of-day stat which uses linear bins.',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--source <name>',
    'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter',
  )
  .option(
    '--min-tokens <n>',
    'hide source rows with total_tokens below n (default 1000); counts surface as droppedSparseSources',
    '1000',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sort; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    'sort key: tokens (default) | centroid | r | spread | source. Applied before --top.',
    'tokens',
  )
  .option(
    '--max-spread <hrs>',
    'display filter: hide sources whose circular spread (hours) strictly exceeds this value. Useful for surfacing only sources with tightly-clustered hour-of-day token mass. Default 0 = no filter. Rows with R=0 (spread=infinity) are also dropped when active.',
    '0',
  )
  .option(
    '--min-r <r>',
    'display filter: hide sources whose resultant length R is strictly below this value. R in [0,1] is the canonical circular concentration measure (1=sharp peak, 0=uniform). Default 0 = no filter. Counts surface as droppedBelowMinR. Applied after --max-spread.',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minTokens: string;
        top: string;
        sort: string;
        maxSpread: string;
        minR: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minTokens = Number.parseFloat(opts.minTokens);
        if (!Number.isFinite(minTokens) || minTokens < 0) {
          throw new Error(
            `--min-tokens must be a non-negative number (got ${opts.minTokens})`,
          );
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const maxSpread = Number.parseFloat(opts.maxSpread);
        if (!Number.isFinite(maxSpread) || maxSpread < 0) {
          throw new Error(
            `--max-spread must be a non-negative number (got ${opts.maxSpread})`,
          );
        }
        const minR = Number.parseFloat(opts.minR);
        if (!Number.isFinite(minR) || minR < 0 || minR > 1) {
          throw new Error(
            `--min-r must be a number in [0, 1] (got ${opts.minR})`,
          );
        }
        const validSorts = ['tokens', 'centroid', 'r', 'spread', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceTokenMassHourCentroid(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minTokens,
          top,
          maxSpread,
          minR,
          sort: opts.sort as 'tokens' | 'centroid' | 'r' | 'spread' | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceTokenMassHourCentroid(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-day-of-week-token-mass-share')
  .description(
    'Per-source distribution of total token mass across the 7 UTC weekdays. Reports share vector (sums to 1), dominant weekday and its share, weekendShare (Sun+Sat), and ln(7)-normalized Shannon entropy. Orthogonal to weekday-share (global) and weekend-vs-weekday (global): this is per-source. Orthogonal to all hour-of-day stats (different axis) and to daily-token-* (collapses date axis, keeps 7-cycle).',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--source <name>',
    'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter',
  )
  .option(
    '--min-tokens <n>',
    'hide source rows with total_tokens below n (default 1000); counts surface as droppedSparseSources',
    '1000',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sort; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    'sort key: tokens (default) | dominant | weekend | entropy | source. Applied before --top.',
    'tokens',
  )
  .option(
    '--min-weekend-share <s>',
    'display filter: hide sources whose weekendShare (share[Sun]+share[Sat]) is strictly below s. s in [0,1]. Default 0 = no filter. Useful for surfacing only weekend-skewed sources (e.g. --min-weekend-share 0.4 hides every source at or below the 2/7 uniform baseline). Counts surface as droppedBelowMinWeekendShare.',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minTokens: string;
        top: string;
        sort: string;
        minWeekendShare: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minTokens = Number.parseFloat(opts.minTokens);
        if (!Number.isFinite(minTokens) || minTokens < 0) {
          throw new Error(
            `--min-tokens must be a non-negative number (got ${opts.minTokens})`,
          );
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const minWeekendShare = Number.parseFloat(opts.minWeekendShare);
        if (
          !Number.isFinite(minWeekendShare) ||
          minWeekendShare < 0 ||
          minWeekendShare > 1
        ) {
          throw new Error(
            `--min-weekend-share must be a number in [0, 1] (got ${opts.minWeekendShare})`,
          );
        }
        const validSorts = ['tokens', 'dominant', 'weekend', 'entropy', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceDayOfWeekTokenMassShare(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minTokens,
          top,
          minWeekendShare,
          sort: opts.sort as
            | 'tokens'
            | 'dominant'
            | 'weekend'
            | 'entropy'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceDayOfWeekTokenMassShare(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('daily-token-gini-coefficient')
  .description(
    'Per-source Gini coefficient of the per-day total_tokens distribution. Collapses hourly buckets to UTC days, then computes Gini over the day vector. Range [0, (n-1)/n]. Order-invariant — orthogonal to z-score / monotone-run / autocorrelation / 2nd-diff sign-runs which read the daily series in order.',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--source <name>',
    'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter',
  )
  .option(
    '--min-tokens <n>',
    'hide source rows with total_tokens below n (default 1000); counts surface as droppedSparseSources',
    '1000',
  )
  .option(
    '--min-days <n>',
    'hide source rows whose nDays is below n (default 2); Gini on n=1 is 0 by definition. Counts surface as droppedBelowMinDays.',
    '2',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sort; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    'sort key: gini (default) | tokens | days | source. Applied before --top.',
    'gini',
  )
  .option(
    '--min-gini <g>',
    'display filter: hide sources whose Gini is strictly below this value. g in [0,1]. Default 0 = no filter. Applied after --min-tokens and --min-days. Counts surface as droppedBelowMinGini.',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minTokens: string;
        minDays: string;
        top: string;
        sort: string;
        minGini: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minTokens = Number.parseFloat(opts.minTokens);
        if (!Number.isFinite(minTokens) || minTokens < 0) {
          throw new Error(
            `--min-tokens must be a non-negative number (got ${opts.minTokens})`,
          );
        }
        const minDays = Number.parseInt(opts.minDays, 10);
        if (!Number.isInteger(minDays) || minDays < 1) {
          throw new Error(
            `--min-days must be a positive integer (got ${opts.minDays})`,
          );
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const minGini = Number.parseFloat(opts.minGini);
        if (!Number.isFinite(minGini) || minGini < 0 || minGini > 1) {
          throw new Error(
            `--min-gini must be a number in [0, 1] (got ${opts.minGini})`,
          );
        }
        const validSorts = ['gini', 'tokens', 'days', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildDailyTokenGini(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minTokens,
          minDays,
          top,
          minGini,
          sort: opts.sort as 'gini' | 'tokens' | 'days' | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderDailyTokenGini(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-hour-of-day-topk-mass-share')
  .description(
    'Per-source share of total token mass concentrated in the K busiest hours-of-day (default K=3) on the 24-hour clock. Range [K/24, 1]. Orthogonal to peak-hour-share (per-day spikiness), source-token-mass-hour-centroid (circular mean position), hour-of-day-token-skew (3rd moment), and bucket-token-gini (mixes hour-of-day with day axis).',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--source <name>',
    'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter',
  )
  .option(
    '--top-hours <k>',
    'K, the number of busiest hours-of-day to sum (default 3). Integer in [1, 24]. Lower bound on share is K/24.',
    '3',
  )
  .option(
    '--min-tokens <n>',
    'hide source rows with total_tokens below n (default 1000); counts surface as droppedSparseSources',
    '1000',
  )
  .option(
    '--min-hours <n>',
    'hide source rows whose nHours (distinct populated hours-of-day) is below n (default 2). Counts surface as droppedBelowMinHours.',
    '2',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sort; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    'sort key: share (default) | tokens | hours | source. Applied before --top.',
    'share',
  )
  .option(
    '--min-share <s>',
    'display filter: hide sources whose topKShare is strictly below s. s in [0, 1]. Default 0 = no filter. Applied after --min-tokens and --min-hours, before sort and --top. Counts surface as droppedBelowMinShare.',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        topHours: string;
        minTokens: string;
        minHours: string;
        top: string;
        sort: string;
        minShare: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const topHours = Number.parseInt(opts.topHours, 10);
        if (!Number.isInteger(topHours) || topHours < 1 || topHours > 24) {
          throw new Error(
            `--top-hours must be an integer in [1, 24] (got ${opts.topHours})`,
          );
        }
        const minTokens = Number.parseFloat(opts.minTokens);
        if (!Number.isFinite(minTokens) || minTokens < 0) {
          throw new Error(
            `--min-tokens must be a non-negative number (got ${opts.minTokens})`,
          );
        }
        const minHours = Number.parseInt(opts.minHours, 10);
        if (!Number.isInteger(minHours) || minHours < 1 || minHours > 24) {
          throw new Error(
            `--min-hours must be an integer in [1, 24] (got ${opts.minHours})`,
          );
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const validSorts = ['share', 'tokens', 'hours', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const minShare = Number.parseFloat(opts.minShare);
        if (!Number.isFinite(minShare) || minShare < 0 || minShare > 1) {
          throw new Error(
            `--min-share must be a number in [0, 1] (got ${opts.minShare})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceHourTopKMassShare(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          topHours,
          minTokens,
          minHours,
          top,
          minShare,
          sort: opts.sort as 'share' | 'tokens' | 'hours' | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceHourTopKMassShare(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-dead-hour-count')
  .description(
    'Per-source count of UTC hours-of-day (0..23) with zero observed token mass over the window. Reports deadHours / liveHours / deadShare plus longestDeadRun and deadRunCount on the circular 24-cycle. Orthogonal to source-token-mass-hour-centroid (centroid, not sparseness), source-hour-of-day-topk-mass-share (top-k mass, not zero count), source-day-of-week-token-mass-share (different axis), source-dry-spell (calendar-day recency, not hour-of-day).',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--source <name>',
    'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter',
  )
  .option(
    '--min-tokens <n>',
    'hide source rows with total_tokens below n (default 1000); counts surface as droppedSparseSources',
    '1000',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sort; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    'sort key: tokens (default) | dead | live | run | source. dead = deadHours desc, run = longestDeadRun desc. Applied before --top.',
    'tokens',
  )
  .option(
    '--min-dead-hours <n>',
    'display filter: hide sources whose deadHours is strictly below n. n in [0,24]. Default 0 = no filter. Useful for surfacing only sparse sources (e.g. --min-dead-hours 12 hides any source that uses more than half the 24-hour clock). Counts surface as droppedBelowMinDeadHours.',
    '0',
  )
  .option(
    '--min-longest-run <n>',
    'display filter: hide sources whose longestDeadRun is strictly below n. n in [0,24]. Default 0 = no filter. Complementary to --min-dead-hours: catches sources whose dead hours form a real contiguous sleep block rather than scattered missing hours. Counts surface as droppedBelowMinLongestRun.',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minTokens: string;
        top: string;
        sort: string;
        minDeadHours: string;
        minLongestRun: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minTokens = Number.parseFloat(opts.minTokens);
        if (!Number.isFinite(minTokens) || minTokens < 0) {
          throw new Error(
            `--min-tokens must be a non-negative number (got ${opts.minTokens})`,
          );
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const minDeadHours = Number.parseInt(opts.minDeadHours, 10);
        if (
          !Number.isInteger(minDeadHours) ||
          minDeadHours < 0 ||
          minDeadHours > 24
        ) {
          throw new Error(
            `--min-dead-hours must be an integer in [0, 24] (got ${opts.minDeadHours})`,
          );
        }
        const minLongestRun = Number.parseInt(opts.minLongestRun, 10);
        if (
          !Number.isInteger(minLongestRun) ||
          minLongestRun < 0 ||
          minLongestRun > 24
        ) {
          throw new Error(
            `--min-longest-run must be an integer in [0, 24] (got ${opts.minLongestRun})`,
          );
        }
        const validSorts = ['tokens', 'dead', 'live', 'run', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceDeadHourCount(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minTokens,
          top,
          minDeadHours,
          minLongestRun,
          sort: opts.sort as 'tokens' | 'dead' | 'live' | 'run' | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceDeadHourCount(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-active-hour-longest-run')
  .description(
    'Per-source longest contiguous run of *active* UTC hours-of-day (positive token mass) on the circular 24-cycle. Reports activeHours, longestActiveRun, activeRunCount, activeRunShare (= longestActiveRun / activeHours), and longestRunStart. Orthogonal to source-dead-hour-count (which measures the *zero* axis): two sources can have identical liveHours but very different longestActiveRun depending on whether their active mass is one solid shift or scattered across the day.',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--source <name>',
    'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter',
  )
  .option(
    '--min-tokens <n>',
    'hide source rows with total_tokens below n (default 1000); counts surface as droppedSparseSources',
    '1000',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sort; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    'sort key: tokens (default) | run | active | share | source. run = longestActiveRun desc, active = activeHours desc, share = activeRunShare desc. Applied before --top.',
    'tokens',
  )
  .option(
    '--min-longest-active-run <n>',
    'display filter: hide sources whose longestActiveRun is strictly below n. n in [0,24]. Default 0 = no filter. Surfaces only sources with a substantial contiguous shift. Counts surface as droppedBelowMinLongestActiveRun.',
    '0',
  )
  .option(
    '--min-active-hours <n>',
    'display filter (refinement, v0.6.45): hide sources whose activeHours (raw count of nonzero hour-of-day bins) is strictly below n. n in [0,24]. Default 0 = no filter. Complementary to --min-longest-active-run: this filters by raw count, that filter measures contiguity. The two compose by intersection. Counts surface as droppedBelowMinActiveHours.',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minTokens: string;
        top: string;
        sort: string;
        minLongestActiveRun: string;
        minActiveHours: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minTokens = Number.parseFloat(opts.minTokens);
        if (!Number.isFinite(minTokens) || minTokens < 0) {
          throw new Error(
            `--min-tokens must be a non-negative number (got ${opts.minTokens})`,
          );
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const minLongestActiveRun = Number.parseInt(opts.minLongestActiveRun, 10);
        if (
          !Number.isInteger(minLongestActiveRun) ||
          minLongestActiveRun < 0 ||
          minLongestActiveRun > 24
        ) {
          throw new Error(
            `--min-longest-active-run must be an integer in [0, 24] (got ${opts.minLongestActiveRun})`,
          );
        }
        const minActiveHours = Number.parseInt(opts.minActiveHours, 10);
        if (
          !Number.isInteger(minActiveHours) ||
          minActiveHours < 0 ||
          minActiveHours > 24
        ) {
          throw new Error(
            `--min-active-hours must be an integer in [0, 24] (got ${opts.minActiveHours})`,
          );
        }
        const validSorts = ['tokens', 'run', 'active', 'share', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceActiveHourLongestRun(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minTokens,
          top,
          minLongestActiveRun,
          minActiveHours,
          sort: opts.sort as 'tokens' | 'run' | 'active' | 'share' | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceActiveHourLongestRun(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-hour-of-day-token-mass-entropy')
  .description(
    'Per-source Shannon entropy (in bits) of token mass over UTC hours-of-day (0..23). Reports entropyBits, entropyNormalized (= entropyBits / log2(24)), effectiveHours (= 2^entropyBits), concentrationGap (= activeHours - effectiveHours), topHour, and topHourShare. Orthogonal to hour-of-day-source-mix-entropy (cross-source axis at each hour, not within-source across hours), source-token-mass-hour-centroid (circular mean, not spread), source-dead-hour-count and source-active-hour-longest-run (which only count *which* hours are positive and treat them equally — entropy weighs them by mass), source-hour-of-day-topk-mass-share (lump share of top-k, not full distributional summary).',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--source <name>',
    'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter',
  )
  .option(
    '--min-tokens <n>',
    'hide source rows with total_tokens below n (default 1000); counts surface as droppedSparseSources',
    '1000',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sort; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    'sort key: tokens (default) | entropy | normalized | effective | gap | top-share | source. entropy/normalized/effective desc; gap = concentrationGap desc (most-illusory-breadth first); top-share = topHourShare desc (most-concentrated first). Applied before --top.',
    'tokens',
  )
  .option(
    '--min-normalized <p>',
    'display filter: hide sources whose entropyNormalized is strictly below p. p in [0, 1]. Default 0 = no filter. Useful for surfacing only sources with genuine spread (e.g. --min-normalized 0.7 keeps only sources using their day broadly). Counts surface as droppedBelowMinNormalized.',
    '0',
  )
  .option(
    '--min-effective-hours <n>',
    'display filter: hide sources whose effectiveHours (= 2^entropyBits, perplexity) is strictly below n. n in [0, 24]. Default 0 = no filter. Complementary to --min-normalized: filters by *real* spread in hour-units rather than by [0,1] ratio. A source with activeHours=24 but effectiveHours=2.1 (mass dumped in two hours, the rest a thin tail) passes --min-normalized 0.3 but is filtered out by --min-effective-hours 6. Counts surface as droppedBelowMinEffectiveHours.',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minTokens: string;
        top: string;
        sort: string;
        minNormalized: string;
        minEffectiveHours: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minTokens = Number.parseFloat(opts.minTokens);
        if (!Number.isFinite(minTokens) || minTokens < 0) {
          throw new Error(
            `--min-tokens must be a non-negative number (got ${opts.minTokens})`,
          );
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const minNormalized = Number.parseFloat(opts.minNormalized);
        if (
          !Number.isFinite(minNormalized) ||
          minNormalized < 0 ||
          minNormalized > 1
        ) {
          throw new Error(
            `--min-normalized must be a number in [0, 1] (got ${opts.minNormalized})`,
          );
        }
        const minEffectiveHours = Number.parseFloat(opts.minEffectiveHours);
        if (
          !Number.isFinite(minEffectiveHours) ||
          minEffectiveHours < 0 ||
          minEffectiveHours > 24
        ) {
          throw new Error(
            `--min-effective-hours must be a number in [0, 24] (got ${opts.minEffectiveHours})`,
          );
        }
        const validSorts = [
          'tokens',
          'entropy',
          'normalized',
          'effective',
          'gap',
          'top-share',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceHourOfDayTokenMassEntropy(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minTokens,
          top,
          minNormalized,
          minEffectiveHours,
          sort: opts.sort as
            | 'tokens'
            | 'entropy'
            | 'normalized'
            | 'effective'
            | 'gap'
            | 'top-share'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceHourOfDayTokenMassEntropy(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-active-hour-span')
  .description(
    'Per-source minimum-arc cover on the circular UTC 24-hour clock containing every active hour-of-day for that source. Reports activeHours, circularSpan (= 24 - largestQuietGap), spanStartHour, spanEndHour, largestQuietGap, and spanDensity (= activeHours / circularSpan). Orthogonal to source-dead-hour-count (frames the *active waking window* rather than the quiet block, and surfaces spanStart/spanEnd/spanDensity), source-active-hour-longest-run (run length is *contiguous* active hours, span is the *cover* whether contiguous or not), source-token-mass-hour-centroid (mean, not width), and source-hour-of-day-token-mass-entropy (mass-weighted spread, not support-set width).',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--source <name>',
    'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter',
  )
  .option(
    '--min-tokens <n>',
    'hide source rows with total_tokens below n (default 1000); counts surface as droppedSparseSources',
    '1000',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sort; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    'sort key: tokens (default) | span | density | active | gap | source. span = circularSpan desc, density = spanDensity desc, active = activeHours desc, gap = largestQuietGap desc. Applied before --top.',
    'tokens',
  )
  .option(
    '--max-span <n>',
    'display filter (refinement, v0.6.47): hide sources whose circularSpan is strictly *above* n. n in [0,24]. Default 0 = no filter (disabled). Use --max-span 12 to surface only sources whose minimum-arc cover fits inside half the day; use --max-span 24 to keep all rows. Counts surface as droppedAboveMaxSpan.',
    '0',
  )
  .option(
    '--min-largest-quiet-gap <n>',
    'display filter (refinement, v0.6.48): hide sources whose largestQuietGap (longest stretch of dead hours-of-day on the circular 24-cycle) is strictly below n. n in [0,24]. Default 0 = no filter. Surfaces only sources with a meaningful "off shift" (e.g. --min-largest-quiet-gap 6 hides any source whose longest dead stretch is shorter than 6 hours). Complementary to --max-span: this filters on the width of the *single longest quiet block*, --max-span filters on the width of the *active cover*. Counts surface as droppedBelowMinLargestQuietGap.',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minTokens: string;
        top: string;
        sort: string;
        maxSpan: string;
        minLargestQuietGap: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minTokens = Number.parseFloat(opts.minTokens);
        if (!Number.isFinite(minTokens) || minTokens < 0) {
          throw new Error(
            `--min-tokens must be a non-negative number (got ${opts.minTokens})`,
          );
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const maxSpan = Number.parseInt(opts.maxSpan, 10);
        if (!Number.isInteger(maxSpan) || maxSpan < 0 || maxSpan > 24) {
          throw new Error(
            `--max-span must be an integer in [0, 24] (got ${opts.maxSpan})`,
          );
        }
        const minLargestQuietGap = Number.parseInt(opts.minLargestQuietGap, 10);
        if (
          !Number.isInteger(minLargestQuietGap) ||
          minLargestQuietGap < 0 ||
          minLargestQuietGap > 24
        ) {
          throw new Error(
            `--min-largest-quiet-gap must be an integer in [0, 24] (got ${opts.minLargestQuietGap})`,
          );
        }
        const validSorts = ['tokens', 'span', 'density', 'active', 'gap', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceActiveHourSpan(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minTokens,
          top,
          maxSpan,
          minLargestQuietGap,
          sort: opts.sort as
            | 'tokens'
            | 'span'
            | 'density'
            | 'active'
            | 'gap'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceActiveHourSpan(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-weekend-weekday-cache-share-gap')
  .description(
    'Per source, compares input-token cache hit share between weekday (Mon..Fri UTC) and weekend (Sat..Sun UTC) buckets and reports the gap. Reports weekdayCacheShare, weekendCacheShare, shareGap (= weekend - weekday), absShareGap (|shareGap|), and shareRatio (= weekend / weekday). Orthogonal to cache-hit-ratio (single global share, not split by source/dow), cache-hit-by-hour (split by hour, not by source and not weekday/weekend), weekend-vs-weekday (compares token volume, not cache share), and source-day-of-week-token-mass-share (mass distribution across 7 dow bins, not cache share).',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--source <name>',
    'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter',
  )
  .option(
    '--min-input-tokens <n>',
    'hide source rows with total input_tokens (weekday + weekend) below n (default 1000); counts surface as droppedSparseSources',
    '1000',
  )
  .option(
    '--min-input-tokens-each-side <n>',
    'display filter (refinement, v0.6.50): require both weekdayInputTokens >= n AND weekendInputTokens >= n. Default 0 = no per-side floor. Surfaces only sources with a comparable sample on both sides so the gap is not dominated by one tiny side. Suppressed counts surface as droppedBelowMinInputTokensEachSide. Filter order: window -> source -> minInputTokens (pooled) -> minInputTokensEachSide (per side) -> sort -> top.',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sort; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    'sort key: absgap (default) | gap | ratio | weekday | weekend | tokens | source. absgap = |shareGap| desc; gap = shareGap desc; ratio = shareRatio desc; weekday/weekend = the named cache share desc; tokens = inputTokens desc; source = alphabetical. Null shares always sort last on numeric keys.',
    'absgap',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minInputTokens: string;
        minInputTokensEachSide: string;
        top: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minInputTokens = Number.parseFloat(opts.minInputTokens);
        if (!Number.isFinite(minInputTokens) || minInputTokens < 0) {
          throw new Error(
            `--min-input-tokens must be a non-negative number (got ${opts.minInputTokens})`,
          );
        }
        const minInputTokensEachSide = Number.parseFloat(
          opts.minInputTokensEachSide,
        );
        if (
          !Number.isFinite(minInputTokensEachSide) ||
          minInputTokensEachSide < 0
        ) {
          throw new Error(
            `--min-input-tokens-each-side must be a non-negative number (got ${opts.minInputTokensEachSide})`,
          );
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const validSorts = [
          'absgap',
          'gap',
          'ratio',
          'weekday',
          'weekend',
          'tokens',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceWeekendWeekdayCacheShareGap(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minInputTokens,
          minInputTokensEachSide,
          top,
          sort: opts.sort as
            | 'absgap'
            | 'gap'
            | 'ratio'
            | 'weekday'
            | 'weekend'
            | 'tokens'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceWeekendWeekdayCacheShareGap(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-daily-token-trend-slope')
  .description(
    'Per source, fits OLS y = a + b*t over (active-day-index, daily total_tokens) across the source\'s active calendar days. Reports slope (tokens per active day), normalizedSlope (slope / mean), r2, and the active-day window. Orthogonal to trend (global week-over-week deltas with sparklines, not per-source OLS), daily-token-zscore-extremes (outlier flag, ignores trend), daily-token-monotone-run-length / daily-token-second-diff-sign-runs / daily-token-autocorrelation-lag1 (order-structure stats, no fitted slope), daily-token-gini-coefficient (concentration, not direction), prompt-output-correlation (regressor is prompt size, not time), source-decay-half-life (exponential fit on decay phase only), and every other source-* lifetime scalar.',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--source <name>',
    'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter',
  )
  .option(
    '--min-active-days <n>',
    'hide source rows with fewer than n active calendar days (default 3); a 1-2 day fit is degenerate. Suppressed surface as droppedBelowMinActiveDays.',
    '3',
  )
  .option(
    '--min-r2 <n>',
    'display filter (refinement, v0.6.52): require r2 >= n in [0, 1] for a source row to be reported. Default 0 = no r2 floor. Sources with r2 == null (flat daily series, zero variance) are always suppressed when --min-r2 > 0. Surfaces only sources with statistically meaningful trends — a +21M tokens/day slope at r2=0.005 is indistinguishable from a flat line. Suppressed surface as droppedBelowMinR2. Filter order: window -> source -> minActiveDays -> minR2 -> sort -> top.',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sort; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    'sort key: absslope (default) | slope | absnorm | norm | r2 | days | tokens | source. absslope = |slope| desc; slope = signed slope desc; absnorm = |normalizedSlope| desc; norm = signed normalizedSlope desc; r2 = r2 desc; days = nActiveDays desc; tokens = totalTokens desc; source = alphabetical. Null normalizedSlope/r2 always sort last on those keys.',
    'absslope',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minActiveDays: string;
        minR2: string;
        top: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minActiveDays = Number.parseInt(opts.minActiveDays, 10);
        if (!Number.isInteger(minActiveDays) || minActiveDays < 2) {
          throw new Error(
            `--min-active-days must be an integer >= 2 (got ${opts.minActiveDays})`,
          );
        }
        const minR2 = Number.parseFloat(opts.minR2);
        if (!Number.isFinite(minR2) || minR2 < 0 || minR2 > 1) {
          throw new Error(
            `--min-r2 must be a number in [0, 1] (got ${opts.minR2})`,
          );
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const validSorts = [
          'absslope',
          'slope',
          'absnorm',
          'norm',
          'r2',
          'days',
          'tokens',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceDailyTokenTrendSlope(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minActiveDays,
          minR2,
          top,
          sort: opts.sort as
            | 'absslope'
            | 'slope'
            | 'absnorm'
            | 'norm'
            | 'r2'
            | 'days'
            | 'tokens'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceDailyTokenTrendSlope(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-burstiness-fano-factor')
  .description(
    "Per source, computes the Fano factor F = variance / mean of daily total_tokens over the source's active UTC calendar days. F=1 = Poisson baseline, F<1 = sub-Poisson (steady), F>1 = super-Poisson (bursty / clustered). Reports meanDaily, stddevDaily, fanoFactor, and cv (= stddev/mean) for cross-reference. Orthogonal to burstiness (CV across hourly buckets at group level, NOT variance/mean over per-source-active-day buckets), rolling-bucket-cv (windowed CV distribution, not a single dispersion index), daily-token-z-score-extremes (outlier flag, not a dispersion scalar), daily-token-gini-coefficient (Lorenz inequality, not variance/mean), source-daily-token-trend-slope (fits a line, not dispersion around mean), and every source-* hour-of-day stat (different axis).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--source <name>',
    'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter',
  )
  .option(
    '--min-active-days <n>',
    'hide source rows with fewer than n active calendar days (default 3); a 2-day variance is degenerate. Suppressed surface as droppedBelowMinActiveDays.',
    '3',
  )
  .option(
    '--min-fano <n>',
    'display filter (refinement, v0.6.54): require fanoFactor >= n for a source row to be reported. Default 0 = no Fano floor. Sources with fanoFactor == null (mean=0) are always suppressed when --min-fano > 0. Use --min-fano 1 to keep only sources at or above the Poisson baseline (the bursty / over-dispersed ones). Suppressed surface as droppedBelowMinFano. Filter order: window -> source -> minActiveDays -> minFano -> sort -> top.',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sort; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    'sort key: fano (default) | cv | mean | variance | days | tokens | source. fano = fanoFactor desc; cv = cv desc; mean = meanDailyTokens desc; variance = varianceDailyTokens desc; days = nActiveDays desc; tokens = totalTokens desc; source = alphabetical. Null fano/cv (mean=0) always sort last on those keys.',
    'fano',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minActiveDays: string;
        minFano: string;
        top: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minActiveDays = Number.parseInt(opts.minActiveDays, 10);
        if (!Number.isInteger(minActiveDays) || minActiveDays < 2) {
          throw new Error(
            `--min-active-days must be an integer >= 2 (got ${opts.minActiveDays})`,
          );
        }
        const minFano = Number.parseFloat(opts.minFano);
        if (!Number.isFinite(minFano) || minFano < 0) {
          throw new Error(
            `--min-fano must be a finite non-negative number (got ${opts.minFano})`,
          );
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const validSorts = [
          'fano',
          'cv',
          'mean',
          'variance',
          'days',
          'tokens',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceBurstinessFanoFactor(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minActiveDays,
          minFano,
          top,
          sort: opts.sort as
            | 'fano'
            | 'cv'
            | 'mean'
            | 'variance'
            | 'days'
            | 'tokens'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceBurstinessFanoFactor(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-cost-class-mix')
  .description(
    "Per source, classifies each positive-token row by total_tokens into small (< smallMax), medium ([smallMax, largeMin)), or large (>= largeMin) cost classes, then reports row-share and token-mass-share for each class. Orthogonal to tail-share (Pareto on hour-of-week buckets, never classifies rows by absolute magnitude), bucket-intensity / output-size (distribution shape stats, not categorical class share), source-burstiness-fano-factor and daily-token-gini-coefficient (dispersion / inequality scalars, not named magnitude classes), and cost / cost-per-bucket-percentiles (cost dollars derivative, not raw token threshold ladder). Headline question: what mix of small/medium/large rows is each source built out of, by both row count and token mass?",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--source <name>',
    'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter',
  )
  .option(
    '--small-max <n>',
    'exclusive upper bound of the small class; rows with total_tokens < smallMax are small (default 1000). Must be a positive integer.',
    '1000',
  )
  .option(
    '--large-min <n>',
    'inclusive lower bound of the large class; rows with total_tokens >= largeMin are large (default 10000). Must be an integer >= smallMax. When largeMin == smallMax the medium class is structurally empty.',
    '10000',
  )
  .option(
    '--min-rows <n>',
    'hide source rows with fewer than n classified rows (default 1). Suppressed surface as droppedBelowMinRows.',
    '1',
  )
  .option(
    '--min-large-pct-tokens <n>',
    'display filter (refinement, v0.6.56): require pctTokensLarge >= n (a fraction in [0, 1]) for a source row to be reported. Default 0 = no floor. Use --min-large-pct-tokens 0.9 to keep only sources where >=90% of tokens come from rows at or above --large-min. Suppressed sources surface as droppedBelowMinLargePctTokens. Filter order: window -> source -> minRows -> minLargePctTokens -> sort -> top.',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sort; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    'sort key: tokens (default) | rows | pctLargeTokens | pctLargeRows | pctSmallTokens | pctSmallRows | source. tokens = totalTokens desc; rows = totalRows desc; pctLargeTokens = pctTokensLarge desc; pctLargeRows = pctRowsLarge desc; pctSmallTokens = pctTokensSmall desc; pctSmallRows = pctRowsSmall desc; source = alphabetical.',
    'tokens',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        smallMax: string;
        largeMin: string;
        minRows: string;
        minLargePctTokens: string;
        top: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const smallMax = Number.parseInt(opts.smallMax, 10);
        if (!Number.isInteger(smallMax) || smallMax <= 0) {
          throw new Error(
            `--small-max must be a positive integer (got ${opts.smallMax})`,
          );
        }
        const largeMin = Number.parseInt(opts.largeMin, 10);
        if (!Number.isInteger(largeMin) || largeMin < smallMax) {
          throw new Error(
            `--large-min must be an integer >= --small-max (got --large-min=${opts.largeMin}, --small-max=${smallMax})`,
          );
        }
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 1) {
          throw new Error(
            `--min-rows must be a positive integer (got ${opts.minRows})`,
          );
        }
        const minLargePctTokens = Number.parseFloat(opts.minLargePctTokens);
        if (
          !Number.isFinite(minLargePctTokens) ||
          minLargePctTokens < 0 ||
          minLargePctTokens > 1
        ) {
          throw new Error(
            `--min-large-pct-tokens must be a finite number in [0, 1] (got ${opts.minLargePctTokens})`,
          );
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const validSorts = [
          'tokens',
          'rows',
          'pctLargeTokens',
          'pctLargeRows',
          'pctSmallTokens',
          'pctSmallRows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceCostClassMix(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          smallMax,
          largeMin,
          minRows,
          minLargePctTokens,
          top,
          sort: opts.sort as
            | 'tokens'
            | 'rows'
            | 'pctLargeTokens'
            | 'pctLargeRows'
            | 'pctSmallTokens'
            | 'pctSmallRows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceCostClassMix(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-cold-warm-row-ratio')
  .description(
    'Per-source split of hour-bucket *rows* into cold (cached_input_tokens === 0) vs warm (> 0), restricted to rows with input_tokens > 0. Reports coldRows / warmRows / coldShare (row-count share), coldInputTokenShare (input-mass share), gap = coldShare - coldInputTokenShare (positive = cold rows are smaller-than-average; negative = the big jobs miss the cache). Orthogonal to cache-hit-ratio (continuous ratio percentiles, not row vs mass split), cache-hit-by-hour (hour-of-day axis, mass-only), source-weekend-weekday-cache-share-gap (mass-only across weekday axis), source-cost-class-mix (partitions by total_tokens, not cache state), and source-io-ratio-stability (output/input ratio, not cache state).',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--source <name>',
    'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter',
  )
  .option(
    '--min-rows <n>',
    'hide source rows with nRows below n (default 5); counts surface as droppedSparseSources',
    '5',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sort; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    'sort key: tokens (default) | rows | cold-share | cold-mass-share | gap | source. gap = |coldRowMassGap| desc. Applied before --top.',
    'tokens',
  )
  .option(
    '--min-abs-gap <n>',
    'display filter: hide sources whose |coldRowMassGap| is strictly below n. n in [0, 1]. Default 0 = no filter. Useful for surfacing only sources with a meaningful row-count vs input-mass mismatch (e.g. --min-abs-gap 0.05 hides anything within 5 percentage points of "cold rows weigh exactly the same as warm rows on average"). Counts surface as droppedBelowMinAbsGap.',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        top: string;
        sort: string;
        minAbsGap: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 0) {
          throw new Error(
            `--min-rows must be a non-negative integer (got ${opts.minRows})`,
          );
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const minAbsGap = Number.parseFloat(opts.minAbsGap);
        if (!Number.isFinite(minAbsGap) || minAbsGap < 0 || minAbsGap > 1) {
          throw new Error(
            `--min-abs-gap must be a finite number in [0, 1] (got ${opts.minAbsGap})`,
          );
        }
        const validSorts = [
          'tokens',
          'rows',
          'cold-share',
          'cold-mass-share',
          'gap',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceColdWarmRowRatio(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          top,
          minAbsGap,
          sort: opts.sort as
            | 'tokens'
            | 'rows'
            | 'cold-share'
            | 'cold-mass-share'
            | 'gap'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceColdWarmRowRatio(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-reasoning-share-by-day-cv')
  .description(
    "Per-source coefficient of variation of the daily reasoning_output_tokens / (output_tokens + reasoning_output_tokens) share across the source's active calendar UTC days. Low CV = stable thinking-vs-typing balance day-over-day; high CV = swings between mostly-visible-output days and mostly-invisible-reasoning days. Distinct from reasoning-share (single global per-model mean, no per-source view, no day axis), source-io-ratio-stability (CV of output/input, not the internal reasoning split), prompt-output-correlation --include-reasoning (collapses reasoning into total output for a single global Pearson r, no daily share sequence), and daily-token-autocorrelation-lag1 (magnitude persistence, ignores reasoning entirely).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--source <name>',
    'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter',
  )
  .option(
    '--min-days <n>',
    'hide source rows with daysWithShare below n (default 3); counts surface as droppedBelowMinDays',
    '3',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sort; remainder surface as droppedBelowTopCap (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    "sort key: tokens (default) | cv | mean | days | source. cv asc = most stable first. ties: source asc.",
    'tokens',
  )
  .option(
    '--min-mean-share <n>',
    'display filter: hide sources whose meanShare is strictly below n. n in [0, 1]. Default 0 = no filter. Useful for suppressing the mathematically-loud-but-substantively-flat regime (e.g. --min-mean-share 0.01 hides anything below 1% average reasoning share, so the CV ranking starts to mean "wild among genuinely reasoning sources"). Counts surface as droppedBelowMinMeanShare.',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minDays: string;
        top: string;
        sort: string;
        minMeanShare: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minDays = Number.parseInt(opts.minDays, 10);
        if (!Number.isInteger(minDays) || minDays < 1) {
          throw new Error(
            `--min-days must be a positive integer (got ${opts.minDays})`,
          );
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const validSorts = ['tokens', 'cv', 'mean', 'days', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const minMeanShare = Number.parseFloat(opts.minMeanShare);
        if (
          !Number.isFinite(minMeanShare) ||
          minMeanShare < 0 ||
          minMeanShare > 1
        ) {
          throw new Error(
            `--min-mean-share must be a finite number in [0, 1] (got ${opts.minMeanShare})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceReasoningShareByDayCv(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minDays,
          top: top === 0 ? null : top,
          sort: opts.sort as 'tokens' | 'cv' | 'mean' | 'days' | 'source',
          minMeanShare,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceReasoningShareByDayCv(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-cache-share-by-day-cv')
  .description(
    "Per-source coefficient of variation of the daily cached_input_tokens / input_tokens share across the source's active calendar UTC days. Low CV = stable cache reuse day-over-day; high CV = swings between cold-prompt days and warm-context days. Distinct from source-cold-warm-row-ratio (row-count split, no day axis), source-weekend-weekday-cache-share-gap (collapses time into two buckets), cache-hit-ratio / cache-hit-by-hour (global, no per-source view), and source-io-ratio-stability (CV of output/input, orthogonal axis).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--source <name>',
    'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter',
  )
  .option(
    '--min-days <n>',
    'hide source rows with daysWithShare below n (default 3); counts surface as droppedBelowMinDays',
    '3',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sort; remainder surface as droppedBelowTopCap (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    "sort key: tokens (default) | cv | mean | days | source. cv asc = most stable first. mean desc = highest cache hitter first. ties: source asc.",
    'tokens',
  )
  .option(
    '--min-mean-share <n>',
    'display filter: hide sources whose meanShare is strictly below n. n in [0, 1]. Default 0 = no filter. Useful for suppressing the mathematically-loud-but-substantively-cold regime (e.g. --min-mean-share 0.05 hides anything below 5% average cache share). Counts surface as droppedBelowMinMeanShare.',
    '0',
  )
  .option(
    '--max-zero-input-day-share <n>',
    'display filter: hide sources whose daysWithZeroInput / activeDays ratio is strictly above n. n in [0, 1]. Default 1 = no filter. Useful for filtering out telemetry-only-day-dominated sources whose mean/cv are computed off statistically thin share-bearing days (e.g. --max-zero-input-day-share 0.5 keeps only sources where at least half of their active days had a prompt assembled). Counts surface as droppedAboveMaxZeroInputDayShare.',
    '1',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minDays: string;
        top: string;
        sort: string;
        minMeanShare: string;
        maxZeroInputDayShare: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minDays = Number.parseInt(opts.minDays, 10);
        if (!Number.isInteger(minDays) || minDays < 1) {
          throw new Error(
            `--min-days must be a positive integer (got ${opts.minDays})`,
          );
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const validSorts = ['tokens', 'cv', 'mean', 'days', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const minMeanShare = Number.parseFloat(opts.minMeanShare);
        if (
          !Number.isFinite(minMeanShare) ||
          minMeanShare < 0 ||
          minMeanShare > 1
        ) {
          throw new Error(
            `--min-mean-share must be a finite number in [0, 1] (got ${opts.minMeanShare})`,
          );
        }
        const maxZeroInputDayShare = Number.parseFloat(opts.maxZeroInputDayShare);
        if (
          !Number.isFinite(maxZeroInputDayShare) ||
          maxZeroInputDayShare < 0 ||
          maxZeroInputDayShare > 1
        ) {
          throw new Error(
            `--max-zero-input-day-share must be a finite number in [0, 1] (got ${opts.maxZeroInputDayShare})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceCacheShareByDayCv(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minDays,
          top: top === 0 ? null : top,
          sort: opts.sort as 'tokens' | 'cv' | 'mean' | 'days' | 'source',
          minMeanShare,
          maxZeroInputDayShare,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceCacheShareByDayCv(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-output-tokens-by-hour-cv')
  .description(
    "Per-source coefficient of variation of the mean per-row output_tokens across the source's populated UTC hours-of-day (0..23). High CV = the source's typical reply size swings across the day (e.g. small interactive replies one hour, long background summaries another); low CV = a source produces the same shape of output regardless of hour. Distinct from hour-of-day-token-skew (global, not per-source), source-hour-of-day-token-mass-entropy (mass concentration not per-row size), source-token-mass-hour-centroid (single circular mean), source-output-tokens-per-row-percentiles (collapses hour axis), source-cache-share-by-day-cv / source-reasoning-share-by-day-cv (CVs of share, not size), and source-burstiness-fano-factor / source-daily-token-trend-slope (day axis).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--source <name>',
    'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter',
  )
  .option(
    '--min-hours <n>',
    'hide source rows with hoursPopulated below n; integer in [1,24] (default 3); counts surface as droppedBelowMinHours',
    '3',
  )
  .option(
    '--min-rows <n>',
    'hide source rows with fewer than n total kept rows (default 1); counts surface as droppedBelowMinRows',
    '1',
  )
  .option(
    '--min-mean-hour-mean <n>',
    'display filter: hide sources whose meanHourMean (mean across populated hours of within-hour mean output_tokens) is strictly below n. Finite non-negative number. Default 0 = no floor. Useful for suppressing the mathematically-loud-but-substantively-tiny regime (e.g. --min-mean-hour-mean 1000 hides sources whose typical per-row reply averages under 1000 tokens). Counts surface as droppedBelowMinMeanHourMean.',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sort; remainder surface as droppedBelowTopCap (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    "sort key: tokens (default) | cv | mean | hours | source. cv desc = most diurnally lumpy first. mean desc = biggest typical per-row output first. ties: source asc.",
    'tokens',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minHours: string;
        minRows: string;
        minMeanHourMean: string;
        top: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minHours = Number.parseInt(opts.minHours, 10);
        if (!Number.isInteger(minHours) || minHours < 1 || minHours > 24) {
          throw new Error(
            `--min-hours must be an integer in [1, 24] (got ${opts.minHours})`,
          );
        }
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 1) {
          throw new Error(
            `--min-rows must be a positive integer (got ${opts.minRows})`,
          );
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const minMeanHourMean = Number.parseFloat(opts.minMeanHourMean);
        if (!Number.isFinite(minMeanHourMean) || minMeanHourMean < 0) {
          throw new Error(
            `--min-mean-hour-mean must be a finite non-negative number (got ${opts.minMeanHourMean})`,
          );
        }
        const validSorts = ['tokens', 'cv', 'mean', 'hours', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceOutputTokensByHourCv(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minHours,
          minRows,
          minMeanHourMean,
          top: top === 0 ? null : top,
          sort: opts.sort as 'tokens' | 'cv' | 'mean' | 'hours' | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceOutputTokensByHourCv(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-input-token-top-row-share')
  .description(
    "Per-source concentration of input_tokens mass in the K largest single rows. Reports top1Share, topKShare (default K=3), and HHI over per-row input_tokens. Distinct from input-token-decile-distribution (global), source-output-tokens-per-row-percentiles (output column, percentile shape not concentration), source-single-day-mass-concentration (daily total_tokens not per-row input), and source-cost-class-mix (count of large-class rows not mass concentration). Surfaces sources whose lifetime input volume is dominated by a few monster prompts.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--top-k <n>',
    'K for the topKShare cumulative concentration (default 3)',
    '3',
  )
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n positive-input rows (default 3)',
    '3',
  )
  .option(
    '--min-top1-share <f>',
    'drop sources whose top1Share is below f, in [0,1] (default 0)',
    '0',
  )
  .option(
    '--min-topk-share <f>',
    'drop sources whose topKShare is below f, in [0,1] (default 0)',
    '0',
  )
  .option(
    '--min-hhi <f>',
    'drop sources whose hhi is below f, in [0,1]; HHI is the cleanest single-number concentration scalar — --min-hhi 0.05 keeps only sources whose effective number of equally-weighted rows is <= 20 (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'tokens' (default) | 'top1' | 'topk' | 'hhi' | 'rows' | 'source'",
    'tokens',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        topK: string;
        minRows: string;
        minTop1Share: string;
        minTopkShare: string;
        minHhi: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const topK = Number.parseInt(opts.topK, 10);
        if (!Number.isInteger(topK) || topK < 1) {
          throw new Error(
            `--top-k must be a positive integer (got ${opts.topK})`,
          );
        }
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 1) {
          throw new Error(
            `--min-rows must be a positive integer (got ${opts.minRows})`,
          );
        }
        const minTop1Share = Number.parseFloat(opts.minTop1Share);
        if (
          !Number.isFinite(minTop1Share) ||
          minTop1Share < 0 ||
          minTop1Share > 1
        ) {
          throw new Error(
            `--min-top1-share must be a finite number in [0, 1] (got ${opts.minTop1Share})`,
          );
        }
        const minTopKShare = Number.parseFloat(opts.minTopkShare);
        if (
          !Number.isFinite(minTopKShare) ||
          minTopKShare < 0 ||
          minTopKShare > 1
        ) {
          throw new Error(
            `--min-topk-share must be a finite number in [0, 1] (got ${opts.minTopkShare})`,
          );
        }
        const minHhi = Number.parseFloat(opts.minHhi);
        if (!Number.isFinite(minHhi) || minHhi < 0 || minHhi > 1) {
          throw new Error(
            `--min-hhi must be a finite number in [0, 1] (got ${opts.minHhi})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = ['tokens', 'top1', 'topk', 'hhi', 'rows', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceInputTokenTopRowShare(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          topK,
          minRows,
          minTop1Share,
          minTopKShare,
          minHhi,
          top,
          sort: opts.sort as
            | 'tokens'
            | 'top1'
            | 'topk'
            | 'hhi'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceInputTokenTopRowShare(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-zero-output-row-share')
  .description(
    "Per-source share of rows with output_tokens==0 (aborted/empty turns). Reports zeroShare = zeroRows/rows and zeroInputShare = sum(input_tokens over zero-output rows) / sum(input_tokens). Distinct from source-output-tokens-per-row-percentiles (percentile shape, not categorical zero-count), source-cost-class-mix (small/med/large by total_tokens), source-input-token-top-row-share (input mass concentration on positive-input rows), and source-cold-warm-row-ratio (cache-state partition). Surfaces sources where the model was invoked but produced no output.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows (default 3)',
    '3',
  )
  .option(
    '--min-zero-share <f>',
    'drop sources whose zeroShare is below f, in [0,1] (default 0)',
    '0',
  )
  .option(
    '--min-zero-input-share <f>',
    'drop sources whose zeroInputShare is below f, in [0,1] (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'zero-share' (default) | 'zero-input-share' | 'zero-rows' | 'rows' | 'source'",
    'zero-share',
  )
  .option(
    '--exclude-zero-input',
    'drop rows with input_tokens==0 before computing zeroShare; isolates aborted-after-prompt-shipped failures from pure accounting artifacts (rows recorded with neither input nor output tokens)',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minZeroShare: string;
        minZeroInputShare: string;
        top?: string;
        sort: string;
        excludeZeroInput?: boolean;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 1) {
          throw new Error(
            `--min-rows must be a positive integer (got ${opts.minRows})`,
          );
        }
        const minZeroShare = Number.parseFloat(opts.minZeroShare);
        if (
          !Number.isFinite(minZeroShare) ||
          minZeroShare < 0 ||
          minZeroShare > 1
        ) {
          throw new Error(
            `--min-zero-share must be a finite number in [0, 1] (got ${opts.minZeroShare})`,
          );
        }
        const minZeroInputShare = Number.parseFloat(opts.minZeroInputShare);
        if (
          !Number.isFinite(minZeroInputShare) ||
          minZeroInputShare < 0 ||
          minZeroInputShare > 1
        ) {
          throw new Error(
            `--min-zero-input-share must be a finite number in [0, 1] (got ${opts.minZeroInputShare})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'zero-share',
          'zero-input-share',
          'zero-rows',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceZeroOutputRowShare(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minZeroShare,
          minZeroInputShare,
          top,
          sort: opts.sort as
            | 'zero-share'
            | 'zero-input-share'
            | 'zero-rows'
            | 'rows'
            | 'source',
          excludeZeroInput: opts.excludeZeroInput === true,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceZeroOutputRowShare(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-gap-hours-cv')
  .description(
    "Per-source coefficient of variation of the inter-bucket gap distribution (gaps in hours between consecutive distinct active UTC hour buckets where the source had token mass > 0). gapCv = stddev(gaps) / mean(gaps). ~0 = clocked-regular, ~1 = Poisson-ish, >>1 = bursty/heavy-tailed. Distinct from interarrival-time (same gap sequence but reported as min/p50/p90/max + histogram, no CV — CV compresses spread into a single ranking number that p50/p90 cannot), source-burstiness-fano-factor (variance-to-mean of per-bucket counts; different statistic), source-active-day-streak (run length on day grain, not gap dispersion), and idle-gaps (per-session message gaps in seconds, not per-source bucket gaps).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-active-hours <n>',
    'drop sources with fewer than n distinct active hour buckets (default 3; need >=2 gaps for non-degenerate CV)',
    '3',
  )
  .option(
    '--min-mean-gap <f>',
    'drop sources whose meanGap (in hours) is strictly below f, finite & non-negative (default 0)',
    '0',
  )
  .option(
    '--min-gaps <n>',
    'drop sources with fewer than n gaps from the table; sharper than --min-active-hours when you want gapCv estimated on a meaningful sample (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'cv' (default) | 'mean-gap' | 'max-gap' | 'active-hours' | 'source'",
    'cv',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minActiveHours: string;
        minMeanGap: string;
        minGaps: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minActiveHours = Number.parseInt(opts.minActiveHours, 10);
        if (!Number.isInteger(minActiveHours) || minActiveHours < 1) {
          throw new Error(
            `--min-active-hours must be a positive integer (got ${opts.minActiveHours})`,
          );
        }
        const minMeanGap = Number.parseFloat(opts.minMeanGap);
        if (!Number.isFinite(minMeanGap) || minMeanGap < 0) {
          throw new Error(
            `--min-mean-gap must be a finite, non-negative number (got ${opts.minMeanGap})`,
          );
        }
        const minGaps = Number.parseInt(opts.minGaps, 10);
        if (!Number.isInteger(minGaps) || minGaps < 0) {
          throw new Error(
            `--min-gaps must be a non-negative integer (got ${opts.minGaps})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = ['cv', 'mean-gap', 'max-gap', 'active-hours', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceGapHoursCv(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minActiveHours,
          minMeanGap,
          minGaps,
          top,
          sort: opts.sort as
            | 'cv'
            | 'mean-gap'
            | 'max-gap'
            | 'active-hours'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceGapHoursCv(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-input-output-correlation-coefficient')
  .description(
    "Per-source Pearson correlation coefficient (r) between per-row input_tokens and per-row output_tokens (computed over rows where both > 0). r ~ +1 means a longer prompt predicts a longer response (Q&A / doc-completion shape); r ~ 0 means prompt and response sizes are decoupled (agentic loops where giant context yields tiny tool calls); r < 0 is unusual. Distinct from prompt-output-correlation (single workspace-wide r, no per-source breakdown — Simpson's-paradox risk), source-output-input-ratio (level statistic on out/in, dominated by mean), source-io-ratio-stability (CV of per-row out/in, dispersion not association), and source-input-token-top-row-share (input mass concentration only).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows (default 3)',
    '3',
  )
  .option(
    '--min-positive-pairs <n>',
    'drop sources with fewer than n positive (in>0, out>0) pairs; r needs >=2 (default 2)',
    '2',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'r-desc' (default) | 'r-asc' | 'abs-r' | 'r-squared' | 'positive-pairs' | 'rows' | 'source'",
    'r-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minPositivePairs: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 1) {
          throw new Error(
            `--min-rows must be a positive integer (got ${opts.minRows})`,
          );
        }
        const minPositivePairs = Number.parseInt(opts.minPositivePairs, 10);
        if (!Number.isInteger(minPositivePairs) || minPositivePairs < 2) {
          throw new Error(
            `--min-positive-pairs must be an integer >= 2 (got ${opts.minPositivePairs})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'r-desc',
          'r-asc',
          'abs-r',
          'r-squared',
          'positive-pairs',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceInputOutputCorrelationCoefficient(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minPositivePairs,
          top,
          sort: opts.sort as
            | 'r-desc'
            | 'r-asc'
            | 'abs-r'
            | 'r-squared'
            | 'positive-pairs'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceInputOutputCorrelationCoefficient(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-first-vs-last-quartile-output-mean-shift')
  .description(
    "Per-source non-parametric chronological drift detector for output_tokens: split each source's rows by hour_start into chronological quartiles, then report mean(output_tokens) of the first 25% vs the last 25%. meanShift = lastQMean - firstQMean (positive = source generates fatter replies now than at debut); relShift = meanShift/firstQMean (unitless, the cross-source comparator). Distinct from source-daily-token-trend-slope (OLS over daily aggregates of total_tokens; assumes linearity, hides within-day variation), source-output-tokens-per-row-percentiles (pools whole window, destroys chronology), source-decay-half-life (assumes monotone decay, cannot express growth), source-cumulative-mass-half-life-day (mass centroid on total_tokens, not reply-size mean), and source-input-output-correlation-coefficient (per-row association, not per-period mean shift).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; absolute floor 4 (need >=1 row per quartile end) (default 4)',
    '4',
  )
  .option(
    '--min-quartile-mean <f>',
    'drop sources where max(firstQMean, lastQMean) < f; useful to suppress tiny-output sources where shift is dominated by noise (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'shift-desc' (default) | 'shift-asc' | 'abs-shift' | 'rel-shift-desc' | 'rel-shift-asc' | 'abs-rel-shift' | 'rows' | 'source'",
    'shift-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minQuartileMean: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        const minQuartileMean = Number.parseFloat(opts.minQuartileMean);
        if (!Number.isFinite(minQuartileMean) || minQuartileMean < 0) {
          throw new Error(
            `--min-quartile-mean must be a finite, non-negative number (got ${opts.minQuartileMean})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'shift-desc',
          'shift-asc',
          'abs-shift',
          'rel-shift-desc',
          'rel-shift-asc',
          'abs-rel-shift',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceFirstVsLastQuartileOutputMeanShift(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minQuartileMean,
          top,
          sort: opts.sort as
            | 'shift-desc'
            | 'shift-asc'
            | 'abs-shift'
            | 'rel-shift-desc'
            | 'rel-shift-asc'
            | 'abs-rel-shift'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceFirstVsLastQuartileOutputMeanShift(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-skewness')
  .description(
    "Per-source Fisher-Pearson sample skewness g1 of per-row total_tokens distribution: g1 = mean((x-mean)^3) / stddev^3. g1>0 = right-skewed (rare fat rows pull the tail; the textbook token-usage shape), g1<0 = left-skewed, ~0 = symmetric. Distinct from hour-of-day-token-skew (global, on per-day totals grouped by hour), source-burstiness-fano-factor (variance/mean, 2nd moment not 3rd), source-output-tokens-per-row-percentiles (quantile shape on output_tokens not moment shape on total_tokens), source-input-token-top-row-share (mass concentration not moment), source-output-token-benford-deviation (digit distribution), source-cumulative-mass-half-life-day (temporal centroid), source-first-vs-last-quartile-output-mean-shift (chronological drift in mean), and daily-token-gini-coefficient (cross-day inequality, not within-source row asymmetry).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; absolute floor 3 (need >=3 samples for a non-degenerate 3rd moment) (default 3)',
    '3',
  )
  .option(
    '--min-mean <f>',
    'drop sources whose per-row total_tokens mean is strictly below f (default 0)',
    '0',
  )
  .option(
    '--min-abs-skew <f>',
    'drop sources whose |skewness| is strictly below f; useful for surfacing only meaningfully asymmetric sources (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'skew-desc' (default) | 'skew-asc' | 'abs-skew' | 'rows' | 'mean' | 'source'",
    'skew-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minMean: string;
        minAbsSkew: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 3) {
          throw new Error(
            `--min-rows must be an integer >= 3 (got ${opts.minRows})`,
          );
        }
        const minMean = Number.parseFloat(opts.minMean);
        if (!Number.isFinite(minMean) || minMean < 0) {
          throw new Error(
            `--min-mean must be a finite, non-negative number (got ${opts.minMean})`,
          );
        }
        const minAbsSkew = Number.parseFloat(opts.minAbsSkew);
        if (!Number.isFinite(minAbsSkew) || minAbsSkew < 0) {
          throw new Error(
            `--min-abs-skew must be a finite, non-negative number (got ${opts.minAbsSkew})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'skew-desc',
          'skew-asc',
          'abs-skew',
          'rows',
          'mean',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenSkewness(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minMean,
          minAbsSkew,
          top,
          sort: opts.sort as
            | 'skew-desc'
            | 'skew-asc'
            | 'abs-skew'
            | 'rows'
            | 'mean'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRowTokenSkewness(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-kurtosis')
  .description(
    "Per-source Fisher excess kurtosis g2 of per-row total_tokens distribution: g2 = m4/m2^2 - 3. g2=0 mesokurtic (Normal-like), g2>0 leptokurtic (heavier tails AND more peaked centre than a Normal of the same variance — extreme rows dominate the 4th moment), g2<0 platykurtic (thinner tails). Distinct from source-row-token-skewness (3rd moment, asymmetry/tail direction; mathematically independent of g2 — Laplace has g1=0,g2=3 and triangular has g1=0,g2=-0.6), source-burstiness-fano-factor (variance/mean on day totals, 2nd moment), source-output-tokens-per-row-percentiles (quantile shape on output_tokens), source-input-token-top-row-share (mass concentration), source-output-token-benford-deviation (digit distribution), source-cumulative-mass-half-life-day (temporal centroid), source-first-vs-last-quartile-output-mean-shift (chronological drift), and daily-token-gini-coefficient (cross-day inequality).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; absolute floor 4 (need >=4 samples for a non-degenerate 4th moment) (default 4)',
    '4',
  )
  .option(
    '--min-mean <f>',
    'drop sources whose per-row total_tokens mean is strictly below f (default 0)',
    '0',
  )
  .option(
    '--min-abs-kurt <f>',
    'drop sources whose |excessKurtosis| is strictly below f; useful for surfacing only meaningfully non-Normal sources (e.g. --min-abs-kurt 1 hides the "approximately mesokurtic" band, --min-abs-kurt 3 hides everything below Laplace-grade tail weight) (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'kurt-desc' (default) | 'kurt-asc' | 'abs-kurt' | 'rows' | 'mean' | 'source'",
    'kurt-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minMean: string;
        minAbsKurt: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        const minMean = Number.parseFloat(opts.minMean);
        if (!Number.isFinite(minMean) || minMean < 0) {
          throw new Error(
            `--min-mean must be a finite, non-negative number (got ${opts.minMean})`,
          );
        }
        const minAbsKurt = Number.parseFloat(opts.minAbsKurt);
        if (!Number.isFinite(minAbsKurt) || minAbsKurt < 0) {
          throw new Error(
            `--min-abs-kurt must be a finite, non-negative number (got ${opts.minAbsKurt})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'kurt-desc',
          'kurt-asc',
          'abs-kurt',
          'rows',
          'mean',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenKurtosis(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minMean,
          minAbsKurt,
          top,
          sort: opts.sort as
            | 'kurt-desc'
            | 'kurt-asc'
            | 'abs-kurt'
            | 'rows'
            | 'mean'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRowTokenKurtosis(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-coefficient-of-variation')
  .description(
    "Per-source coefficient of variation cv = stddev / mean of per-row total_tokens distribution. Scale-free dispersion: doubling every row leaves cv unchanged. cv=0 all rows identical, cv~1 stddev equals mean (exponential-like baseline), cv>>1 a few rows dwarf the typical row. Distinct from source-burstiness-fano-factor (variance/mean on day totals — Fano carries token units and grows with absolute scale; CV is dimensionless and at row grain), source-row-token-skewness (3rd moment, asymmetry — mathematically independent of CV), source-row-token-kurtosis (4th moment, tail weight — mathematically independent of CV), source-output-tokens-per-row-percentiles (quantile shape on output_tokens not moment shape on total_tokens), source-output-tokens-by-hour-cv (CV across 24 hour-of-day bins, a temporal dispersion stat at hour grain), source-gap-hours-cv (CV of inter-row gap lengths, a cadence stat), source-cache-share-by-day-cv and source-reasoning-share-by-day-cv (CV of daily ratios, stability-of-mix at day grain), source-io-ratio-stability (CV of daily output/input ratio), burstiness and rolling-bucket-cv (global/windowed CVs of token-per-bucket), and the various concentration / share / temporal lenses (input-token-top-row-share, cumulative-mass-half-life-day, cold-warm-row-ratio, zero-output-row-share, daily-token-gini-coefficient, first-vs-last-quartile-output-mean-shift).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; absolute floor 2 (need >=2 samples for a non-degenerate 2nd moment) (default 2)',
    '2',
  )
  .option(
    '--min-mean <f>',
    'drop sources whose per-row total_tokens mean is strictly below f; useful for suppressing tiny-row sources where a single outlier inflates CV (default 0)',
    '0',
  )
  .option(
    '--min-cv <f>',
    'drop sources whose cv is strictly below f; useful for surfacing only meaningfully-dispersed sources (e.g. --min-cv 1.0 hides everything tighter than the exponential baseline; --min-cv 0.5 hides the tightly-clustered band) (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'cv-desc' (default) | 'cv-asc' | 'rows' | 'mean' | 'stddev' | 'source'",
    'cv-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minMean: string;
        minCv: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 2) {
          throw new Error(
            `--min-rows must be an integer >= 2 (got ${opts.minRows})`,
          );
        }
        const minMean = Number.parseFloat(opts.minMean);
        if (!Number.isFinite(minMean) || minMean < 0) {
          throw new Error(
            `--min-mean must be a finite, non-negative number (got ${opts.minMean})`,
          );
        }
        const minCv = Number.parseFloat(opts.minCv);
        if (!Number.isFinite(minCv) || minCv < 0) {
          throw new Error(
            `--min-cv must be a finite, non-negative number (got ${opts.minCv})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'cv-desc',
          'cv-asc',
          'rows',
          'mean',
          'stddev',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenCoefficientOfVariation(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minMean,
          minCv,
          top,
          sort: opts.sort as
            | 'cv-desc'
            | 'cv-asc'
            | 'rows'
            | 'mean'
            | 'stddev'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenCoefficientOfVariation(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-mad')
  .description(
    "Per-source Median Absolute Deviation (MAD) of per-row total_tokens. mad = median(|x - median(x)|); robust dispersion (50% breakdown point — outliers do not move it). Reports raw mad, madScaled = 1.4826 * mad (the Normal-consistency-scaled MAD; equals stddev under Normal data), and madRatio = mad / median (robust scale-free spread; the median/MAD analog of CV). Distinct from source-row-token-coefficient-of-variation (mean/stddev based — both dominated by outliers; identical CV can hide wildly different MAD, and the gap quantifies outlier leverage), source-row-token-skewness (3rd standardised moment), source-row-token-kurtosis (4th standardised moment, both also outlier-sensitive), source-output-tokens-per-row-percentiles (quantile shape on output_tokens not robust dispersion on total_tokens), source-output-tokens-by-hour-cv (CV across 24 hour-bins, temporal), source-gap-hours-cv (CV of cadence not values), source-burstiness-fano-factor (variance/mean on day totals), and the various daily-ratio CVs and concentration / share lenses.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; absolute floor 2 (default 2)',
    '2',
  )
  .option(
    '--min-median <f>',
    'drop sources whose per-row total_tokens median is strictly below f (default 0)',
    '0',
  )
  .option(
    '--min-mad-ratio <f>',
    'drop sources whose madRatio = mad / median is strictly below f; cohort selector for "robust scale-free spread is meaningful" (e.g. --min-mad-ratio 0.5 hides everything tighter than "median absolute deviation is half the median"; --min-mad-ratio 1.0 surfaces only sources whose typical absolute deviation equals or exceeds the typical row size — heavy-tailed-or-bimodal cohort) (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'mad-desc' (default) | 'mad-asc' | 'ratio-desc' | 'ratio-asc' | 'rows' | 'median' | 'source'",
    'mad-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minMedian: string;
        minMadRatio: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 2) {
          throw new Error(
            `--min-rows must be an integer >= 2 (got ${opts.minRows})`,
          );
        }
        const minMedian = Number.parseFloat(opts.minMedian);
        if (!Number.isFinite(minMedian) || minMedian < 0) {
          throw new Error(
            `--min-median must be a finite, non-negative number (got ${opts.minMedian})`,
          );
        }
        const minMadRatio = Number.parseFloat(opts.minMadRatio);
        if (!Number.isFinite(minMadRatio) || minMadRatio < 0) {
          throw new Error(
            `--min-mad-ratio must be a finite, non-negative number (got ${opts.minMadRatio})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'mad-desc',
          'mad-asc',
          'ratio-desc',
          'ratio-asc',
          'rows',
          'median',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenMad(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minMedian,
          minMadRatio,
          top,
          sort: opts.sort as
            | 'mad-desc'
            | 'mad-asc'
            | 'ratio-desc'
            | 'ratio-asc'
            | 'rows'
            | 'median'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRowTokenMad(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-gini')
  .description(
    "Per-source Gini coefficient of per-row total_tokens. G in [0,1); 0 = every row carries identical token mass; -> 1 = a single row carries essentially all mass. Reports gini, giniUnbiased = n/(n-1)*gini (small-sample bias-corrected), and meanToMedian as a skew-direction sanity check. Distinct from daily-token-gini-coefficient (per-day totals, day-grain inequality), bucket-token-gini (per-5min-bucket totals, bucket-grain), source-row-token-coefficient-of-variation (CV depends only on first two moments; identical CV can hide wildly different Gini), source-row-token-mad (median-anchored dispersion; bimodal symmetric distributions can have moderate MAD but Gini ~0.5), source-row-token-skewness/kurtosis (3rd/4th moments — shape, not concentration), source-input-token-top-row-share / source-cumulative-mass-half-life-day (single-quantile concentration; Gini integrates the entire Lorenz curve), source-output-tokens-per-row-percentiles (quantile spread on output_tokens not total_tokens), and the various share / count statistics.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; absolute floor 2 (default 2)',
    '2',
  )
  .option(
    '--min-mean <f>',
    'drop sources whose per-row total_tokens mean is strictly below f (default 0)',
    '0',
  )
  .option(
    '--min-gini <f>',
    'drop sources whose gini is strictly below f; cohort selector for "row-level inequality is meaningful" (e.g. --min-gini 0.4 surfaces only sources with high inequality where a handful of rows carry a disproportionate share; --min-gini 0.6 surfaces only sources with extreme inequality — the "few rows do all the work" cohort). Must be in [0, 1). Default 0',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'gini-desc' (default) | 'gini-asc' | 'unbiased-desc' | 'unbiased-asc' | 'rows' | 'mean' | 'source'",
    'gini-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minMean: string;
        minGini: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 2) {
          throw new Error(
            `--min-rows must be an integer >= 2 (got ${opts.minRows})`,
          );
        }
        const minMean = Number.parseFloat(opts.minMean);
        if (!Number.isFinite(minMean) || minMean < 0) {
          throw new Error(
            `--min-mean must be a finite, non-negative number (got ${opts.minMean})`,
          );
        }
        const minGini = Number.parseFloat(opts.minGini);
        if (!Number.isFinite(minGini) || minGini < 0 || minGini >= 1) {
          throw new Error(
            `--min-gini must be a finite number in [0, 1) (got ${opts.minGini})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'gini-desc',
          'gini-asc',
          'unbiased-desc',
          'unbiased-asc',
          'rows',
          'mean',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenGini(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minMean,
          minGini,
          top,
          sort: opts.sort as
            | 'gini-desc'
            | 'gini-asc'
            | 'unbiased-desc'
            | 'unbiased-asc'
            | 'rows'
            | 'mean'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRowTokenGini(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-same-model-streak')
  .description(
    "Per-source longest run of consecutive queue rows (ordered by hour_start asc, model asc tiebreak) sharing the same model. Reports rowsKept, streakCount (number of maximal same-model runs; equivalently 1 + adjacent model switches), longestStreak, longestStreakModel, longestStreakRatio = longestStreak/rowsKept (1.0 = source pinned to a single model on every row; ~1/n = source rotates models every row), and meanStreakLength = rowsKept/streakCount. Distinct from model-switching (rate of switches, not the longest run between them; identical switch rates can mask wildly different longest runs), bucket-streak-length (per-MODEL runs of consecutive active BUCKETS — bucket-grain, model-grouped; this is per-SOURCE runs of consecutive ROWS — row-grain, source-grouped), source-run-lengths (run-lengths of same-SOURCE across SESSIONS; this is run-lengths of same-MODEL across QUEUE ROWS within a single source), model-tenure / model-cohabitation (lifetimes / overlap, not longest uninterrupted stretch).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows (default 2)',
    '2',
  )
  .option(
    '--min-streak <n>',
    'drop sources whose longestStreak is strictly below n (default 1)',
    '1',
  )
  .option(
    '--min-ratio <f>',
    'drop sources whose longestStreakRatio is strictly below f; cohort selector for "model-locked" sources (e.g. --min-ratio 0.9 surfaces only sources where the longest run covers >=90% of rows). Must be in [0, 1]. (default 0)',
    '0',
  )
  .option(
    '--min-mean-streak <f>',
    'drop sources whose meanStreakLength (= rowsKept / streakCount) is strictly below f. Orthogonal to --min-ratio: --min-ratio gates on the single longest run, --min-mean-streak gates on the average run length across all streaks. A source with one giant run + many singletons can score high on longestStreakRatio but low on meanStreakLength, and vice versa. Must be a finite number >= 1. (default 1)',
    '1',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'streak-desc' (default) | 'streak-asc' | 'ratio-desc' | 'ratio-asc' | 'rows' | 'switches' | 'source'",
    'streak-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minStreak: string;
        minRatio: string;
        minMeanStreak: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 1) {
          throw new Error(
            `--min-rows must be a positive integer (got ${opts.minRows})`,
          );
        }
        const minStreak = Number.parseInt(opts.minStreak, 10);
        if (!Number.isInteger(minStreak) || minStreak < 1) {
          throw new Error(
            `--min-streak must be a positive integer (got ${opts.minStreak})`,
          );
        }
        const minRatio = Number.parseFloat(opts.minRatio);
        if (!Number.isFinite(minRatio) || minRatio < 0 || minRatio > 1) {
          throw new Error(
            `--min-ratio must be a finite number in [0, 1] (got ${opts.minRatio})`,
          );
        }
        const minMeanStreak = Number.parseFloat(opts.minMeanStreak);
        if (!Number.isFinite(minMeanStreak) || minMeanStreak < 1) {
          throw new Error(
            `--min-mean-streak must be a finite number >= 1 (got ${opts.minMeanStreak})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'streak-desc',
          'streak-asc',
          'ratio-desc',
          'ratio-asc',
          'rows',
          'switches',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceSameModelStreak(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minStreak,
          minRatio,
          minMeanStreak,
          top,
          sort: opts.sort as
            | 'streak-desc'
            | 'streak-asc'
            | 'ratio-desc'
            | 'ratio-asc'
            | 'rows'
            | 'switches'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceSameModelStreak(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-peak-hour-of-day-argmax')
  .description(
    "Per-source argmax over the hour-of-day [0..23] (UTC) total_tokens mass histogram: which UTC hour does each source's mass peak at, and is that peak a sharp single-hour spike or a broad plateau? Reports peakHour, peakShare (peak/total), secondHour, secondShare, and margin (peakShare - secondShare; 1.0 iff source uses exactly one hour). A mode-like statistic, deliberately distinct from source-token-mass-hour-centroid (the mean-like centroid of the same histogram — they coincide only for unimodal symmetric daily patterns), source-hour-of-day-token-mass-entropy (Shannon dispersion), source-hour-of-day-top-k-mass-share (cumulative top-k mass; at k=1 gives same peakShare value but not which hour and not the margin to #2), source-dead-hour-count, source-active-hour-longest-run, source-active-hour-span, source-day-of-week-token-mass-share, source-cumulative-mass-half-life-day, peak-hour (workspace-wide, not per-source), and hour-of-day-token-skew (workspace-wide).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows (default 1)',
    '1',
  )
  .option(
    '--min-mass <f>',
    'drop sources whose total total_tokens mass T is strictly below f (default 0)',
    '0',
  )
  .option(
    '--min-margin <f>',
    'drop sources whose margin (peakShare - secondShare) is strictly below f; cohort selector for sources with statistically meaningful peaks (e.g. --min-margin 0.05 hides sources where #1 and #2 differ by less than 5pp). f must be in [0, 1]. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'margin-desc' (default) | 'margin-asc' | 'peak-share' | 'peak-hour' | 'mass' | 'rows' | 'source'",
    'margin-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minMass: string;
        minMargin: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 1) {
          throw new Error(
            `--min-rows must be a positive integer (got ${opts.minRows})`,
          );
        }
        const minMass = Number.parseFloat(opts.minMass);
        if (!Number.isFinite(minMass) || minMass < 0) {
          throw new Error(
            `--min-mass must be a finite, non-negative number (got ${opts.minMass})`,
          );
        }
        const minMargin = Number.parseFloat(opts.minMargin);
        if (!Number.isFinite(minMargin) || minMargin < 0 || minMargin > 1) {
          throw new Error(
            `--min-margin must be a finite number in [0, 1] (got ${opts.minMargin})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'margin-desc',
          'margin-asc',
          'peak-share',
          'peak-hour',
          'mass',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourcePeakHourOfDayArgmax(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minMass,
          minMargin,
          top,
          sort: opts.sort as
            | 'margin-desc'
            | 'margin-asc'
            | 'peak-share'
            | 'peak-hour'
            | 'mass'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourcePeakHourOfDayArgmax(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-autocorrelation-lag1')
  .description(
    "Per-source lag-1 (Pearson) autocorrelation of `total_tokens` across queue rows ordered by hour_start asc (model asc, device_id asc as tiebreaks). rho1 in [-1, 1]: positive = consecutive rows have similar token sizes (sticky/persistent producer), negative = adjacent rows alternate big/small (anti-persistent), ~0 = white-noise-like. Distinct from daily-token-autocorrelation-lag1 (day-grain on aggregated daily totals; cannot see within-day stickiness — every row of a 50-row day collapses to one daily total; this is row-grain so adjacent calls inside the same hour count), source-row-token-coefficient-of-variation / source-row-token-mad / source-row-token-gini / source-row-token-skewness / source-row-token-kurtosis (marginal distribution shape; blind to row ordering — shuffling rows leaves them unchanged but zeros out lag-1 autocorrelation), source-same-model-streak / model-switching / provider-switching-frequency (categorical stickiness — which model is sticky — not numerical stickiness of token magnitude), source-input-output-correlation-coefficient (cross-axis Pearson on the same row vs this lens which is same-axis Pearson on adjacent rows), interarrival-time / source-gap-hours-cv (gap-spacing stats, not value persistence). flat=true marks sources with var(x)=0 where rho1 is conventionally reported as 0 to distinguish 'literally undefined' from 'noisy zero'.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; must be an integer >= 3 (need >= 2 adjacent pairs for a meaningful Pearson) (default 3)',
    '3',
  )
  .option(
    '--min-abs-rho <f>',
    "drop sources whose |rho1| is strictly below f; cohort selector for sources with non-trivial autocorrelation in either direction. Drops `flat: true` sources too. f must be in [0, 1]. (default 0)",
    '0',
  )
  .option(
    '--min-mean <f>',
    'drop sources whose mean total_tokens is strictly below f; cohort selector that gates out "tiny producer noise" — sources whose row magnitudes are so small that even a strong autocorrelation signal carries little absolute mass. Orthogonal to --min-abs-rho: a source can have mean=5K and rho1=0.95 (tiny but sticky, gated by --min-mean) or mean=10M and rho1=0.05 (huge but white-noise, gated by --min-abs-rho). f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'rho-desc' (default) | 'rho-asc' | 'abs-rho-desc' | 'rows' | 'mean' | 'source'",
    'rho-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minAbsRho: string;
        minMean: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 3) {
          throw new Error(
            `--min-rows must be an integer >= 3 (got ${opts.minRows})`,
          );
        }
        const minAbsRho = Number.parseFloat(opts.minAbsRho);
        if (!Number.isFinite(minAbsRho) || minAbsRho < 0 || minAbsRho > 1) {
          throw new Error(
            `--min-abs-rho must be a finite number in [0, 1] (got ${opts.minAbsRho})`,
          );
        }
        const minMean = Number.parseFloat(opts.minMean);
        if (!Number.isFinite(minMean) || minMean < 0) {
          throw new Error(
            `--min-mean must be a finite, non-negative number (got ${opts.minMean})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'rho-desc',
          'rho-asc',
          'abs-rho-desc',
          'rows',
          'mean',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenAutocorrelationLag1(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minAbsRho,
          minMean,
          top,
          sort: opts.sort as
            | 'rho-desc'
            | 'rho-asc'
            | 'abs-rho-desc'
            | 'rows'
            | 'mean'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenAutocorrelationLag1(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-iqr-ratio')
  .description(
    "Per-source robust dispersion of total_tokens across queue rows: iqrRatio = (q3 - q1) / median, computed via type-7 (linear-interpolation) quantiles. Headline: how spread out is the central 50% of per-row token magnitudes relative to the typical row, measured by *order statistics* (immune to single-value outliers). Distinct from source-row-token-coefficient-of-variation (mean+stddev — both inflated arbitrarily by a single huge outlier), source-row-token-mad (also robust but uses *all* rows summarised by median-of-absolute-deviations vs this lens which deliberately ignores the outer 50%), source-row-token-gini (Lorenz-curve concentration index over the whole distribution; not a width-relative-to-centre measure), source-row-token-skewness / source-row-token-kurtosis (shape moments; say nothing about *width*), source-row-token-autocorrelation-lag1 (ordering persistence; blind to dispersion), source-output-tokens-per-row-percentiles (raw percentiles of *output_tokens* only, leaves any ratio computation to the operator), cost-per-bucket-percentiles (dollar cost per hour-bucket, not per-row token magnitudes). flat=true marks sources with iqr=0 (constant central rows; iqrRatio=0). degenerate=true marks sources with median=0 but iqr>0 (sparse-burst pattern: > 50% of rows are zero plus a non-trivial top quartile; the ratio diverges and is reported as null rather than +Infinity).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; must be an integer >= 4 (need at least one observation per quartile slot for a meaningful Q1/Q3) (default 4)',
    '4',
  )
  .option(
    '--min-iqr-ratio <f>',
    'drop sources whose iqrRatio is strictly below f; cohort selector for sources whose central spread is non-trivial relative to their typical magnitude. With f > 0, drops degenerate (median=0, iqr>0) sources too (their iqrRatio is null) — counted under droppedDegenerate so the operator sees they were dropped because of *what* they are, not because of *how big* they are. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--min-median <f>',
    'drop sources whose median total_tokens is strictly below f; cohort selector that gates out "tiny producer noise" — sources whose typical row magnitude is so small that the iqrRatio scalar (a *relative* dispersion) carries little absolute mass. Genuinely orthogonal to --min-iqr-ratio: a source can have median=2K and iqrRatio=4.0 (tiny but spread out — gated by --min-median) or median=10M and iqrRatio=0.05 (huge but tight — gated by --min-iqr-ratio). f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'iqr-ratio-desc' (default) | 'iqr-ratio-asc' | 'iqr-desc' | 'median-desc' | 'rows' | 'source'",
    'iqr-ratio-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minIqrRatio: string;
        minMedian: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        const minIqrRatio = Number.parseFloat(opts.minIqrRatio);
        if (!Number.isFinite(minIqrRatio) || minIqrRatio < 0) {
          throw new Error(
            `--min-iqr-ratio must be a finite, non-negative number (got ${opts.minIqrRatio})`,
          );
        }
        const minMedian = Number.parseFloat(opts.minMedian);
        if (!Number.isFinite(minMedian) || minMedian < 0) {
          throw new Error(
            `--min-median must be a finite, non-negative number (got ${opts.minMedian})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'iqr-ratio-desc',
          'iqr-ratio-asc',
          'iqr-desc',
          'median-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenIqrRatio(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minIqrRatio,
          minMedian,
          top,
          sort: opts.sort as
            | 'iqr-ratio-desc'
            | 'iqr-ratio-asc'
            | 'iqr-desc'
            | 'median-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRowTokenIqrRatio(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-bowley-skewness')
  .description(
    "Per-source Bowley / Yule-Kendall robust quartile skewness of per-row total_tokens: B = ((q3 - q2) - (q2 - q1)) / (q3 - q1) using type-7 quantiles. B in [-1, +1]: 0 = central 50% symmetric around the median, B>0 = right-skewed central half (median sits closer to Q1; upper quartile gap dominates), B<0 = left-skewed central half. 50%-breakdown robust analog of Fisher-Pearson g1 — uses only Q1, median, Q3, so a single huge outlier cannot move it. Distinct from source-row-token-skewness (third standardised moment of the WHOLE distribution; unbounded; one outlier moves it arbitrarily — Bowley uses three order statistics and is hard-bounded in [-1,+1]; the two ranks can disagree when asymmetry is in the tail vs central half), source-row-token-kurtosis (fourth moment, tail weight not asymmetry), source-row-token-iqr-ratio (uses the same three quantiles to measure WIDTH of central 50% relative to median; says nothing about which side of Q2 the spread sits — two sources can share iqrRatio=1.0 with B=+0.8 and B=-0.8), source-row-token-mad / -gini / -coefficient-of-variation / -burstiness-coefficient (dispersion or concentration; direction-blind), and every order-sensitive lens (-autocorrelation-lag1 / -runs-test / -turning-point-count / -mann-kendall-trend / -permutation-entropy / -sample-entropy / -hurst-rs / -dfa / -higuchi-fd / -petrosian-fd / -katz-fd / -hjorth-* / -spectral-* / -zero-crossing-rate / -teager-kaiser / -lempel-ziv / -renyi-entropy — shuffling rows leaves Bowley unchanged but moves all of them). Also distinct from hour-of-day-token-skew (g1 on per-day totals grouped by hour, pooled across all sources — different grain, different aggregation). degenerate=true marks sources with iqr=0 (q1=q2=q3; Bowley mathematically 0/0, reported as 0).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; must be an integer >= 4 (need at least one observation per quartile slot for a meaningful Q1/Q3) (default 4)',
    '4',
  )
  .option(
    '--min-median <f>',
    'drop sources whose median total_tokens is strictly below f; cohort selector that gates out tiny-row producers where the central-half asymmetry rides on a handful of small rows. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--min-abs-bowley <f>',
    'drop sources whose |bowley| is strictly below f; cohort selector for meaningfully asymmetric central halves (e.g. --min-abs-bowley 0.1 hides sources whose median sits within 10% of the IQR midpoint). With f > 0, degenerate (iqr=0) sources are also dropped under droppedDegenerate, not droppedBelowMinAbsBowley. f must be in [0, 1]. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'bowley-desc' (default) | 'bowley-asc' | 'abs-bowley' | 'iqr-desc' | 'median-desc' | 'rows' | 'source'",
    'bowley-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minMedian: string;
        minAbsBowley: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        const minMedian = Number.parseFloat(opts.minMedian);
        if (!Number.isFinite(minMedian) || minMedian < 0) {
          throw new Error(
            `--min-median must be a finite, non-negative number (got ${opts.minMedian})`,
          );
        }
        const minAbsBowley = Number.parseFloat(opts.minAbsBowley);
        if (
          !Number.isFinite(minAbsBowley) ||
          minAbsBowley < 0 ||
          minAbsBowley > 1
        ) {
          throw new Error(
            `--min-abs-bowley must be a finite number in [0, 1] (got ${opts.minAbsBowley})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'bowley-desc',
          'bowley-asc',
          'abs-bowley',
          'iqr-desc',
          'median-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenBowleySkewness(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minMedian,
          minAbsBowley,
          top,
          sort: opts.sort as
            | 'bowley-desc'
            | 'bowley-asc'
            | 'abs-bowley'
            | 'iqr-desc'
            | 'median-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenBowleySkewness(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-coefficient-of-quartile-deviation')
  .description(
    "Per-source coefficient of quartile deviation CQD = (q3 - q1) / (q3 + q1) of per-row total_tokens (type-7 quantiles). CQD in [0, 1] for non-negative data: 0 iff q1=q3 (central 50% collapses to a single value), 1 iff q1=0 with q3>0 (lower quartile sits on zero — at least 25% of rows carry zero tokens). Robust 50%-breakdown analog of CV; outlier-immune; scale-invariant; hard-bounded. Distinct from source-row-token-iqr-ratio (same numerator but denominator is the MEDIAN, not q3+q1; iqr-ratio is unbounded above and undefined when median=0; the two ranks can disagree when one source has small median vs another with median ~ q3), source-row-token-bowley-skewness (uses same three quantiles to measure DIRECTION of central skew; CQD is direction-blind — two sources can share CQD=0.6 with Bowley=+0.8 and -0.8), source-row-token-mad (uses all rows then summarises by median of absolute deviations; CQD uses only Q1 and Q3 and discards both tails), source-row-token-coefficient-of-variation (sigma/mu, moment-based, unbounded above, dominated by outliers; CQD uses order statistics and is bounded), source-row-token-burstiness-coefficient (same (b-a)/(b+a) algebraic form but with sigma and mu instead of q3 and q1; the two ranks can disagree because moments are outlier-dominated), source-row-token-gini (Lorenz concentration over the WHOLE distribution; CQD uses three order statistics), and every order-sensitive lens (-autocorrelation-lag1 / -runs-test / -turning-point-count / -mann-kendall-trend / -permutation-entropy / -sample-entropy / -hurst-rs / -dfa / -hjorth-* / -spectral-* / -temporal-* etc — shuffling rows leaves CQD unchanged but moves all of them). degenerate=true marks sources with q3+q1=0 (q1=q3=0; CQD mathematically 0/0, reported as 0).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; must be an integer >= 4 (need at least one observation per quartile slot for a meaningful Q1/Q3) (default 4)',
    '4',
  )
  .option(
    '--min-q3 <f>',
    'drop sources whose q3 (75th percentile) of total_tokens is strictly below f; cohort selector that gates out tiny-row producers. The natural anchor for a CQD lens — median can be 0 even when q3 > 0; q3 itself is the right "is there any usable upper-half magnitude" gate. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--min-cqd <f>',
    'drop sources whose CQD is strictly below f; cohort selector for meaningfully dispersed central halves (e.g. --min-cqd 0.5 hides sources whose central 50% is tightly clustered). With f > 0, degenerate (q3+q1=0) sources are also dropped under droppedDegenerate, not droppedBelowMinCqd. f must be in [0, 1]. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'cqd-desc' (default) | 'cqd-asc' | 'iqr-desc' | 'q3-desc' | 'rows' | 'source'",
    'cqd-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minQ3: string;
        minCqd: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        const minQ3 = Number.parseFloat(opts.minQ3);
        if (!Number.isFinite(minQ3) || minQ3 < 0) {
          throw new Error(
            `--min-q3 must be a finite, non-negative number (got ${opts.minQ3})`,
          );
        }
        const minCqd = Number.parseFloat(opts.minCqd);
        if (!Number.isFinite(minCqd) || minCqd < 0 || minCqd > 1) {
          throw new Error(
            `--min-cqd must be a finite number in [0, 1] (got ${opts.minCqd})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'cqd-desc',
          'cqd-asc',
          'iqr-desc',
          'q3-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenCoefficientOfQuartileDeviation(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minQ3,
          minCqd,
          top,
          sort: opts.sort as
            | 'cqd-desc'
            | 'cqd-asc'
            | 'iqr-desc'
            | 'q3-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenCoefficientOfQuartileDeviation(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-burstiness-coefficient')
  .description(
    "Per-source Goh & Barabasi (2008) burstiness coefficient B = (sigma - mu) / (sigma + mu) of total_tokens across queue rows, with sigma the population stddev (divisor n) and mu the mean. B in [-1, 1]: -1 perfectly periodic / constant series, 0 exponential / Poisson-like baseline (sigma == mu), -> 1 maximally bursty (one or a handful of rows dwarf the rest). Bounded monotone transform of cv: B = (cv - 1) / (cv + 1). Same source ranking as cv but with three concrete anchor regimes that gate cleanly on a fixed threshold (e.g. --min-b 0 = 'show me only super-Poisson sources'). Distinct from source-row-token-coefficient-of-variation (raw open-ended cv on (0, +inf); same ranking but no built-in regime anchors), source-burstiness-fano-factor (Fano variance/mean on per-day totals — different grain, different functional form, different bounds, different anchor F=1~Poisson vs B=0~Poisson), source-row-token-iqr-ratio / source-row-token-mad (robust order-statistic / median-anchored spread vs centre — outlier-immune; B is moment-based and dominated by extreme rows), source-row-token-gini (Lorenz-curve concentration index integrating pairwise differences over the whole distribution — different axis), source-row-token-skewness / source-row-token-kurtosis (3rd / 4th moment shape, not the mean/stddev ratio), source-row-token-autocorrelation-lag1 (ordering persistence; blind to dispersion), source-same-model-streak (categorical stickiness, not numerical), source-output-tokens-per-row-percentiles (raw percentiles on output_tokens, no single comparable scalar). flat=true marks sources with sigma=0 (constant series; B=-1 unless all-zero). degenerate=true marks sources with sigma=0 AND mu=0 (B undefined; reported as null instead of NaN).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; must be an integer >= 2 (need at least two observations for any non-trivial sigma) (default 2)',
    '2',
  )
  .option(
    '--min-b <f>',
    'drop sources whose burstiness coefficient b is strictly below f; cohort selector. f must be a finite number in [-1, 1]. With f > -1, drops degenerate (sigma=0, mu=0) sources too (their b is null) — counted under droppedDegenerate so the operator sees they were dropped because of *what* they are, not because of *how bursty* they are. (default -1, no floor)',
    '-1',
  )
  .option(
    '--min-mean <f>',
    'drop sources whose mean total_tokens is strictly below f; cohort selector that gates out "tiny producer noise" — sources whose typical row magnitude is so small that the burstiness coefficient B (a *relative* dispersion regime scalar) carries little absolute mass. Genuinely orthogonal to --min-b: a source can have mean=5K and B=0.45 (tiny rows but heavy-tailed regime — gated by --min-mean) or mean=12M and B=0.06 (huge rows but only mildly super-Poisson — gated by --min-b 0.1). f must be a finite, non-negative number. (default 0, no floor)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'b-desc' (default) | 'b-asc' | 'abs-b-desc' | 'mean-desc' | 'rows' | 'source'",
    'b-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minB: string;
        minMean: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 2) {
          throw new Error(
            `--min-rows must be an integer >= 2 (got ${opts.minRows})`,
          );
        }
        const minB = Number.parseFloat(opts.minB);
        if (!Number.isFinite(minB) || minB < -1 || minB > 1) {
          throw new Error(
            `--min-b must be a finite number in [-1, 1] (got ${opts.minB})`,
          );
        }
        const minMean = Number.parseFloat(opts.minMean);
        if (!Number.isFinite(minMean) || minMean < 0) {
          throw new Error(
            `--min-mean must be a finite, non-negative number (got ${opts.minMean})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'b-desc',
          'b-asc',
          'abs-b-desc',
          'mean-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenBurstinessCoefficient(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minB,
          minMean,
          top,
          sort: opts.sort as
            | 'b-desc'
            | 'b-asc'
            | 'abs-b-desc'
            | 'mean-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenBurstinessCoefficient(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-runs-test')
  .description(
    "Per-source Wald-Wolfowitz runs test on the per-row total_tokens sequence dichotomised at the source's own median. Signs: +1 if total_tokens > median, -1 if < median; ties (== median) are dropped. Runs R = number of maximal contiguous same-sign blocks in the time-ordered sequence. Under H0 (i.i.d.) E[R] = 1 + 2*n1*n2/n and Var[R] = 2*n1*n2*(2*n1*n2 - n)/(n^2*(n-1)); Z = (R - E[R]) / sigmaR is asymptotically N(0,1) and is reported with a two-sided normal-approx p-value. Z << 0 -> too few runs, above/below-median rows are CLUMPED (positive serial dependence / regime persistence). Z >> 0 -> too many runs, above/below-median rows ALTERNATE more than chance (negative serial dependence / mean-reversion). Genuinely orthogonal to source-row-token-autocorrelation-lag1 (Pearson rho on raw values, linear, parametric — runs test is non-parametric on the sign sequence), to source-row-token-burstiness-coefficient / -coefficient-of-variation / -iqr-ratio / -mad / -gini / -skewness / -kurtosis (all order-invariant marginal-distribution lenses; runs test depends entirely on ordering), and to source-same-model-streak (categorical run length on model identity, not on token-volume sign).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n sign-classified (post-tie-drop) rows; must be an integer >= 4 (the normal-approx Z is unreliable below this) (default 8)',
    '8',
  )
  .option(
    '--max-p <f>',
    'drop sources whose two-sided runs-test p-value is strictly above f; cohort selector that surfaces only sources with statistically detectable non-randomness. f must be a finite number in (0, 1]. (default 1, no floor)',
    '1',
  )
  .option(
    '--min-abs-z <f>',
    'drop sources whose absolute Z statistic is strictly below f; cohort selector on the direction-agnostic non-randomness *effect size* (how many null-stddevs R is from E[R], regardless of how that translates to a tail probability). f must be a finite, non-negative number. Combined with --max-p both gates apply (logical AND); each gate counts its own drops separately. (default 0, no floor)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'abs-z-desc' (default) | 'z-asc' | 'z-desc' | 'p-asc' | 'rows' | 'source'",
    'abs-z-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        maxP: string;
        minAbsZ: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        const maxP = Number.parseFloat(opts.maxP);
        if (!Number.isFinite(maxP) || maxP <= 0 || maxP > 1) {
          throw new Error(
            `--max-p must be a finite number in (0, 1] (got ${opts.maxP})`,
          );
        }
        const minAbsZ = Number.parseFloat(opts.minAbsZ);
        if (!Number.isFinite(minAbsZ) || minAbsZ < 0) {
          throw new Error(
            `--min-abs-z must be a finite, non-negative number (got ${opts.minAbsZ})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'z-asc',
          'z-desc',
          'abs-z-desc',
          'p-asc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenRunsTest(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          maxP,
          minAbsZ,
          top,
          sort: opts.sort as
            | 'z-asc'
            | 'z-desc'
            | 'abs-z-desc'
            | 'p-asc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenRunsTest(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-turning-point-count')
  .description(
    "Per-source Wallis-Moore turning-point test on the per-row total_tokens time-ordered sequence. T = number of interior positions i where v[i] is a strict local extremum (peak: v[i]>v[i-1] AND v[i]>v[i+1]; or trough: v[i]<v[i-1] AND v[i]<v[i+1]). Equality at either neighbour disqualifies position i (counted as tiePosition). Under H0 (i.i.d. continuous) E[T]=2(n-2)/3, Var[T]=(16n-29)/90; Z=(T-E[T])/sigma is asymptotically N(0,1) and is reported with a two-sided normal-approx p-value. Z<<0 -> too few turning points, series TOO SMOOTH (trend / first-difference persistence). Z>>0 -> too many turning points, series TOO JAGGED (first-difference mean-reversion). Genuinely orthogonal to source-row-token-runs-test (median dichotomy, not first-difference signs — a saw-tooth that crosses the median often is jagged at the value scale but smooth at the step scale, and vice versa), to source-row-token-autocorrelation-lag1 (linear Pearson rho on raw values vs. non-parametric on consecutive triples), and to all order-invariant dispersion/shape lenses (-iqr-ratio / -mad / -skewness / -kurtosis / -gini / -burstiness / -coefficient-of-variation).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n post-window rows; must be an integer >= 4 (the formula needs n-2 >= 2 and the normal-approx is unreliable below 8) (default 8)',
    '8',
  )
  .option(
    '--max-p <f>',
    'drop sources whose two-sided turning-point-test p-value is strictly above f. f must be in (0, 1]. (default 1, no floor)',
    '1',
  )
  .option(
    '--min-abs-z <f>',
    'drop sources whose absolute Z statistic is strictly below f; direction-agnostic effect-size cohort selector. (default 0, no floor)',
    '0',
  )
  .option(
    '--max-tie-fraction <f>',
    'drop sources whose fraction of interior positions that are ties (tiePositions / (n-2)) is strictly above f. f must be in (0, 1]. Orthogonal to --max-p / --min-abs-z: those gate on statistical significance under the i.i.d.-continuous null; this gates on the continuous-distribution premise itself, filtering out plateau-dominated sources whose Z is informative mostly about how discrete the series is. (default 1, no floor)',
    '1',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'abs-z-desc' (default) | 'z-asc' | 'z-desc' | 'p-asc' | 'rows' | 'source'",
    'abs-z-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        maxP: string;
        minAbsZ: string;
        maxTieFraction: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        const maxP = Number.parseFloat(opts.maxP);
        if (!Number.isFinite(maxP) || maxP <= 0 || maxP > 1) {
          throw new Error(
            `--max-p must be a finite number in (0, 1] (got ${opts.maxP})`,
          );
        }
        const minAbsZ = Number.parseFloat(opts.minAbsZ);
        if (!Number.isFinite(minAbsZ) || minAbsZ < 0) {
          throw new Error(
            `--min-abs-z must be a finite, non-negative number (got ${opts.minAbsZ})`,
          );
        }
        const maxTieFraction = Number.parseFloat(opts.maxTieFraction);
        if (
          !Number.isFinite(maxTieFraction) ||
          maxTieFraction <= 0 ||
          maxTieFraction > 1
        ) {
          throw new Error(
            `--max-tie-fraction must be a finite number in (0, 1] (got ${opts.maxTieFraction})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'z-asc',
          'z-desc',
          'abs-z-desc',
          'p-asc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenTurningPointCount(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          maxP,
          minAbsZ,
          maxTieFraction,
          top,
          sort: opts.sort as
            | 'z-asc'
            | 'z-desc'
            | 'abs-z-desc'
            | 'p-asc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenTurningPointCount(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-permutation-entropy')
  .description(
    "Per-source Bandt-Pompe permutation entropy on the per-row total_tokens time-ordered sequence (default order m=3). Each length-m sliding window is mapped to its ordinal pattern (rank order with j<k tiebreak for equal values); PE = -sum p log p / log(m!) is reported in [0, 1]. PE near 1 = ordinal patterns ~uniform, series order-equivalent to i.i.d. continuous noise at scale m. PE near 0 = a single permutation dominates (strict monotone or strict alternation). Genuinely orthogonal to runs-test (median dichotomy, not ordinal triples), to turning-point-count (collapses the m=3 permutations into 2 classes; PE separates monotone-up from monotone-down within the no-turning-point class), to lag-1 autocorrelation (linear, parametric, on raw values vs. non-parametric on ranks), and to all order-invariant dispersion / shape lenses.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--order <m>',
    'embedding dimension m (a.k.a. order). Integer in [2, 6]. (default 3)',
    '3',
  )
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n post-window rows; must be an integer >= order+2 (default 8)',
    '8',
  )
  .option(
    '--max-tie-window-fraction <f>',
    'drop sources whose fraction of windows that contain at least one tie (tieWindowFraction) is strictly above f. f must be in (0, 1]. Orthogonal to --min-rows: that gates statistical power; this gates the Bandt-Pompe distinct-value premise itself, filtering out tiebreaker-dominated discrete series whose PE is biased low by the j<k tiebreak. (default 1, no floor)',
    '1',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'pe-asc' (default; most-regular first) | 'pe-desc' (most-complex first) | 'rows' | 'source'",
    'pe-asc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        order: string;
        minRows: string;
        maxTieWindowFraction: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const order = Number.parseInt(opts.order, 10);
        if (!Number.isInteger(order) || order < 2 || order > 6) {
          throw new Error(
            `--order must be an integer in [2, 6] (got ${opts.order})`,
          );
        }
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < order + 2) {
          throw new Error(
            `--min-rows must be an integer >= order+2 (=${order + 2}) (got ${opts.minRows})`,
          );
        }
        const maxTieWindowFraction = Number.parseFloat(opts.maxTieWindowFraction);
        if (
          !Number.isFinite(maxTieWindowFraction) ||
          maxTieWindowFraction <= 0 ||
          maxTieWindowFraction > 1
        ) {
          throw new Error(
            `--max-tie-window-fraction must be a finite number in (0, 1] (got ${opts.maxTieWindowFraction})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = ['pe-asc', 'pe-desc', 'rows', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenPermutationEntropy(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          order,
          minRows,
          maxTieWindowFraction,
          top,
          sort: opts.sort as 'pe-asc' | 'pe-desc' | 'rows' | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenPermutationEntropy(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-mann-kendall-trend')
  .description(
    "Per-source Mann-Kendall rank-based monotonic trend test on the per-row total_tokens time-ordered sequence. S = sum_{i<j} sign(v[j] - v[i]); under H0 (i.i.d.) E[S] = 0 and Var[S] = [n(n-1)(2n+5) - sum_t t(t-1)(2t+5)] / 18 with the tie-correction sum over value-side tie groups. Z is continuity-corrected (Z = (S - 1)/sigma if S > 0, (S + 1)/sigma if S < 0, 0 otherwise) and asymptotically N(0,1); two-sided normal-approx p-value is reported. tau = Kendall's tau-b in [-1, +1] (signed concordance scalar; sample-size-agnostic). tau ~ +1 / Z >> 0 -> later rows monotonically larger (UP trend). tau ~ -1 / Z << 0 -> later rows monotonically smaller (DOWN trend). Genuinely orthogonal to source-row-token-runs-test (median-dichotomy is direction-blind to monotone trend; reads clumped for both up and down), to source-row-token-turning-point-count (jaggedness scalar, not direction), to source-row-token-autocorrelation-lag1 (Pearson rho, linear-parametric on raw values vs. non-parametric all-pair), to source-row-token-permutation-entropy (local m=3 ordinal patterns vs. global pairwise concordance), and to every order-invariant dispersion / shape lens (-iqr-ratio / -mad / -skewness / -kurtosis / -gini / -burstiness / -coefficient-of-variation). Distinct from source-daily-token-trend-slope, which is a per-source linear OLS slope on the daily-aggregated token mass — this lens operates per-row, is non-parametric, and reports a concordance scalar (not a slope in tokens/day).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n rows; must be an integer >= 4 (the normal-approx Z is unreliable below this for Mann-Kendall) (default 8)',
    '8',
  )
  .option(
    '--max-p <f>',
    'drop sources whose two-sided Mann-Kendall p-value is strictly above f; cohort selector that surfaces only sources with statistically detectable monotonic trend. f must be a finite number in (0, 1]. (default 1, no floor)',
    '1',
  )
  .option(
    '--min-abs-tau <g>',
    "drop sources whose |tau| is strictly below g; cohort selector on the direction-agnostic concordance *effect size* — sample-size-independent (vs. --max-p which is sample-size-aware: a long source with a tiny tau can clear --max-p but fails --min-abs-tau). g must be a finite number in [0, 1]. Combined with --max-p both gates apply (logical AND); each gate counts its own drops separately. (default 0, no floor)",
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'abs-z-desc' (default) | 'z-asc' | 'z-desc' | 'tau-asc' | 'tau-desc' | 'abs-tau-desc' | 'p-asc' | 'rows' | 'source'",
    'abs-z-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        maxP: string;
        minAbsTau: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        const maxP = Number.parseFloat(opts.maxP);
        if (!Number.isFinite(maxP) || maxP <= 0 || maxP > 1) {
          throw new Error(
            `--max-p must be a finite number in (0, 1] (got ${opts.maxP})`,
          );
        }
        const minAbsTau = Number.parseFloat(opts.minAbsTau);
        if (!Number.isFinite(minAbsTau) || minAbsTau < 0 || minAbsTau > 1) {
          throw new Error(
            `--min-abs-tau must be a finite number in [0, 1] (got ${opts.minAbsTau})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'z-asc',
          'z-desc',
          'abs-z-desc',
          'tau-asc',
          'tau-desc',
          'abs-tau-desc',
          'p-asc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenMannKendallTrend(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          maxP,
          minAbsTau,
          top,
          sort: opts.sort as
            | 'z-asc'
            | 'z-desc'
            | 'abs-z-desc'
            | 'tau-asc'
            | 'tau-desc'
            | 'abs-tau-desc'
            | 'p-asc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenMannKendallTrend(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-hurst-rs')
  .description(
    "Per-source Hurst exponent via classical rescaled-range (R/S) analysis on the per-row total_tokens time-ordered sequence. For each window size m in a log-spaced grid in [min-window, floor(n/2)], split the series into floor(n/m) non-overlapping chunks; per chunk compute R = max(cum dev) - min(cum dev) and S = sqrt((1/m) sum (x - mu)^2); average R/S over chunks. H = OLS slope of log((R/S)_m) vs log(m). H ~ 0.5 = random walk; H > 0.5 = persistent (long-range positive memory across many scales); H < 0.5 = anti-persistent / mean-reverting. Genuinely orthogonal to mann-kendall-trend / daily-trend-slope (direction lenses), to runs-test (single-scale dichotomy), to lag-1 autocorrelation (single-lag linear-parametric), to permutation-entropy (local m=3 ordinal patterns), to turning-point-count (jaggedness), and to every order-invariant dispersion / shape lens. Caveat: a strict monotone trend can drive R/S H -> 1 spuriously — cross-check with mann-kendall-trend before claiming long-range dependence on a trended source.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n rows; integer >= 16. Default 32 (R/S needs enough rows to support a multi-scale regression).',
    '32',
  )
  .option(
    '--min-window <n>',
    'smallest window size m in the log-spaced scale grid; integer >= 4. Default 8.',
    '8',
  )
  .option(
    '--max-scales <n>',
    'maximum distinct log-spaced scales evaluated; integer >= 3. Default 12.',
    '12',
  )
  .option(
    '--min-scales <n>',
    'minimum usable scales required to keep a source; integer >= 3 and <= max-scales. Default 3.',
    '3',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'abs-hurst-deviation-desc' (default, |H - 0.5| desc) | 'hurst-asc' | 'hurst-desc' | 'r2-desc' | 'rows' | 'scales' | 'source'",
    'abs-hurst-deviation-desc',
  )
  .option(
    '--detrend',
    'subtract a per-chunk OLS linear fit before R/S (DFA-style preprocessing). Removes the within-chunk linear ramp and so reads multi-scale memory of the *residuals* rather than gross trend; addresses the documented R/S H -> 1 failure mode on monotone series. Default off (classical R/S).',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minWindow: string;
        maxScales: string;
        minScales: string;
        top?: string;
        sort: string;
        detrend?: boolean;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 16) {
          throw new Error(
            `--min-rows must be an integer >= 16 (got ${opts.minRows})`,
          );
        }
        const minWindow = Number.parseInt(opts.minWindow, 10);
        if (!Number.isInteger(minWindow) || minWindow < 4) {
          throw new Error(
            `--min-window must be an integer >= 4 (got ${opts.minWindow})`,
          );
        }
        const maxScales = Number.parseInt(opts.maxScales, 10);
        if (!Number.isInteger(maxScales) || maxScales < 3) {
          throw new Error(
            `--max-scales must be an integer >= 3 (got ${opts.maxScales})`,
          );
        }
        const minScales = Number.parseInt(opts.minScales, 10);
        if (!Number.isInteger(minScales) || minScales < 3) {
          throw new Error(
            `--min-scales must be an integer >= 3 (got ${opts.minScales})`,
          );
        }
        if (minScales > maxScales) {
          throw new Error(
            `--min-scales (${minScales}) must not exceed --max-scales (${maxScales})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'hurst-asc',
          'hurst-desc',
          'abs-hurst-deviation-desc',
          'r2-desc',
          'rows',
          'scales',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenHurstRs(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minWindow,
          maxScales,
          minScales,
          top,
          sort: opts.sort as
            | 'hurst-asc'
            | 'hurst-desc'
            | 'abs-hurst-deviation-desc'
            | 'r2-desc'
            | 'rows'
            | 'scales'
            | 'source',
          detrend: opts.detrend === true,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRowTokenHurstRs(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-sample-entropy')
  .description(
    "Per-source Sample Entropy (Richman-Moorman 2000) on the per-row total_tokens time-ordered sequence. SampEn = -ln(A / B), where B = number of length-m template-vector pairs (i,j), i<j, that match in Chebyshev distance <= r*sigma, and A = the subset of those pairs whose extension to length m+1 also matches. Lower SampEn (~0) = more regular / more predictable length-m -> length-(m+1) extensions. Higher SampEn = more random. sigma is the population stddev of the per-source value sequence; tolerance r is unitless and defaults to 0.2 (canonical). Genuinely orthogonal to source-row-token-permutation-entropy (PE collapses each window to its ordinal pattern; SampEn keeps the metric information and asks whether two windows are numerically close at tolerance r*sigma — a series can be PE~1 and SampEn-low or vice versa), to source-row-token-hurst-rs (multi-scale memory exponent vs. single-scale conditional irregularity), to source-row-token-mann-kendall-trend / -runs-test / -turning-point-count (directional / dichotomy / extremum, not pattern-extension matching), to source-row-token-autocorrelation-lag1 (linear, parametric, lag-1 only vs. m-th order non-parametric), and to all order-invariant dispersion / shape lenses (-iqr-ratio / -mad / -skewness / -kurtosis / -gini / -burstiness / -coefficient-of-variation; shuffling leaves them unchanged but pushes SampEn toward its high-randomness regime).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--m <m>',
    'embedding dimension m. Integer in [1, 6]. (default 2)',
    '2',
  )
  .option(
    '--r <f>',
    'unitless tolerance multiplier r; absolute tolerance = r * sigma_v. Finite positive number. (default 0.2)',
    '0.2',
  )
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n rows; must be an integer >= m+2 (default 12)',
    '12',
  )
  .option(
    '--min-template-matches <n>',
    'drop non-degenerate sources whose length-m match count B is strictly below n. Cohort selector on the SampEn estimator count regime: ratios A/B with tiny B are statistically unstable. Orthogonal to --min-rows: that gates n; this gates B itself (B does not scale linearly with n — wide dynamic range can yield small B even at large n). Degenerate rows (B=0 or A=0&B>0) are exempt and surface via their own counters; combine with a sufficiently large value to also drop them. Integer >= 0. (default 0, no floor)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'sampen-asc' (default; most-regular first; degenerate rows sink) | 'sampen-desc' (most-random first; degenerate rows sink) | 'rows' | 'source'",
    'sampen-asc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        m: string;
        r: string;
        minRows: string;
        minTemplateMatches: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const m = Number.parseInt(opts.m, 10);
        if (!Number.isInteger(m) || m < 1 || m > 6) {
          throw new Error(`--m must be an integer in [1, 6] (got ${opts.m})`);
        }
        const r = Number.parseFloat(opts.r);
        if (!Number.isFinite(r) || r <= 0) {
          throw new Error(`--r must be a finite positive number (got ${opts.r})`);
        }
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < m + 2) {
          throw new Error(
            `--min-rows must be an integer >= m+2 (=${m + 2}) (got ${opts.minRows})`,
          );
        }
        const minTemplateMatches = Number.parseInt(opts.minTemplateMatches, 10);
        if (!Number.isInteger(minTemplateMatches) || minTemplateMatches < 0) {
          throw new Error(
            `--min-template-matches must be an integer >= 0 (got ${opts.minTemplateMatches})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = ['sampen-asc', 'sampen-desc', 'rows', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenSampleEntropy(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          m,
          r,
          minRows,
          minTemplateMatches,
          top,
          sort: opts.sort as 'sampen-asc' | 'sampen-desc' | 'rows' | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenSampleEntropy(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-higuchi-fd')
  .description(
    "Per-source Higuchi Fractal Dimension (Higuchi 1988, Physica D 31:277-283) on the per-row total_tokens time-ordered sequence. HFD is the negated OLS slope of log(L(k)) vs log(k) for k = 1..kMax, where L(k) is Higuchi's normalised average path length under stride-k sub-sampling. HFD ~ 1.0 = smooth curve; HFD ~ 1.5 = Brownian-like; HFD ~ 2.0 = white-noise-like / space-filling. Genuinely orthogonal to source-row-token-hurst-rs (R/S of cumulative deviations vs. arc-length scaling — equivalent only for ideal fBm; on empirical mixed-regime sequences the two estimators routinely disagree and rankings do not preserve), to source-row-token-permutation-entropy (ordinal-only vs. fully metric), to source-row-token-sample-entropy (single-scale conditional irregularity at one (m, r) vs. multi-scale arc-length scaling), to mann-kendall / runs / turning-point (directional / dichotomy / extremum), to lag-1 autocorrelation (linear, parametric, single lag), and to all order-invariant dispersion / shape lenses (shuffling leaves them invariant but pushes HFD toward its ~2 regime).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--k-max <n>',
    'maximum sub-sampling stride kMax. Higuchi regression uses k = 1..kMax. Integer in [2, 64]. (default 8)',
    '8',
  )
  .option(
    '--min-k <n>',
    'minimum number of usable scales required for the slope fit. Integer in [2, kMax]. (default 4)',
    '4',
  )
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n rows; must be an integer >= kMax+2 (default 16)',
    '16',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'hfd-asc' (default; smoothest first) | 'hfd-desc' (roughest first) | 'rows' | 'source'",
    'hfd-asc',
  )
  .option(
    '--detrend',
    'subtract the OLS linear trend from each per-source value sequence before computing L(k). Isolates deviation-from-drift roughness; recommended for sources with strong monotone drift, where the raw HFD is biased toward 1 by the trend.',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        kMax: string;
        minK: string;
        minRows: string;
        top?: string;
        sort: string;
        detrend?: boolean;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const kMax = Number.parseInt(opts.kMax, 10);
        if (!Number.isInteger(kMax) || kMax < 2 || kMax > 64) {
          throw new Error(`--k-max must be an integer in [2, 64] (got ${opts.kMax})`);
        }
        const minK = Number.parseInt(opts.minK, 10);
        if (!Number.isInteger(minK) || minK < 2 || minK > kMax) {
          throw new Error(
            `--min-k must be an integer in [2, kMax=${kMax}] (got ${opts.minK})`,
          );
        }
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < kMax + 2) {
          throw new Error(
            `--min-rows must be an integer >= kMax+2 (=${kMax + 2}) (got ${opts.minRows})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = ['hfd-asc', 'hfd-desc', 'rows', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenHiguchiFd(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          kMax,
          minK,
          minRows,
          top,
          detrend: opts.detrend === true,
          sort: opts.sort as 'hfd-asc' | 'hfd-desc' | 'rows' | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenHiguchiFd(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-katz-fd')
  .description(
    "Per-source Katz Fractal Dimension (Katz 1988, Comput. Biol. Med. 18(3):145-156) on the per-row total_tokens time-ordered sequence treated as a 2D planar curve. KFD = log10(n) / (log10(n) + log10(d/L)) on the Katz-normalised curve where L is total Euclidean path length, d is the maximum chord from the start, n = N-1. KFD ~ 1.0 = near-straight; KFD ~ 1.3-1.5 = moderate roughness; KFD -> 2 = heavily oscillating / space-filling. Genuinely orthogonal to source-row-token-higuchi-fd (multi-stride scaling exponent vs. closed-form single-scale geometric ratio - coincide only for ideal self-similar curves), to hurst-rs (R/S), to dfa (detrended fluctuations of cumulative profile), to permutation-entropy / sample-entropy (ordinal / single-scale conditional irregularity), to mann-kendall / runs / turning-point, to autocorr-lag1, to lempel-ziv / renyi-entropy (symbolic / histogrammatic), and to all order-invariant dispersion / shape lenses (shuffling pumps L while leaving d roughly comparable, so KFD typically rises sharply under shuffle).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n rows; integer >= 4 (default 16)',
    '16',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'kfd-asc' (default; straightest first) | 'kfd-desc' (most coiled first) | 'rows' | 'source'",
    'kfd-asc',
  )
  .option(
    '--detrend',
    'subtract the OLS linear trend from each per-source value sequence before computing L, d, KFD. Isolates deviation-from-drift roughness; recommended for sources with strong monotone drift, where the raw KFD is biased downward (toward 1) by the trend.',
  )
  .option(
    '--planform <mode>',
    "plan-form selector: '2d' (default; Katz 1988 original on the (i, v) curve) or '1d' (Esteller et al. 2001 value-only variant — strips the unit-step i-axis padding so KFD spreads over a much wider dynamic range, making cross-source rankings far more discriminating)",
    '2d',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        top?: string;
        sort: string;
        detrend?: boolean;
        planform: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = ['kfd-asc', 'kfd-desc', 'rows', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        if (opts.planform !== '2d' && opts.planform !== '1d') {
          throw new Error(
            `--planform must be '2d' or '1d' (got ${opts.planform})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenKatzFd(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          top,
          detrend: opts.detrend === true,
          planform: opts.planform as '2d' | '1d',
          sort: opts.sort as 'kfd-asc' | 'kfd-desc' | 'rows' | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRowTokenKatzFd(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-hjorth-mobility')
  .description(
    "Per-source Hjorth Mobility (Hjorth 1970, EEG Clin. Neurophysiol. 29:306-310) on the per-row total_tokens time-ordered sequence. mobility = sqrt(var(diff(v)) / var(v)), in units of 1/step. Scale-invariant. Hits 0 for DC-like / heavily smoothed series, ~1.414 (sqrt 2) for pure white noise, > sqrt(2) for anti-correlated / Nyquist-oscillatory series. Genuinely orthogonal to katz-fd / higuchi-fd (path-length geometric ratios vs. variance ratio), to dfa (cumulative-profile detrended scaling vs. raw first-difference), to hurst-rs (R/S of cumulative deviations vs. lag-1 variance ratio), to autocorrelation-lag1 (algebraically related as mobility^2 = 2*(1-rho_1) only for purely stationary series; differs under drift because mobility uses the empirical variance of the diff series), to permutation-entropy / sample-entropy (ordinal / pattern-matching), to mann-kendall / runs / turning-point, to lempel-ziv / renyi-entropy (symbolic / histogrammatic), and to all order-invariant dispersion / shape lenses (shuffling pumps var(dv) sharply while leaving var(v) untouched, so mobility typically rises under shuffle).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n rows; integer >= 4 (default 16)',
    '16',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'mobility-asc' (default; smoothest first) | 'mobility-desc' (most jittery first) | 'rows' | 'source'",
    'mobility-asc',
  )
  .option(
    '--detrend',
    'subtract the OLS linear trend from each per-source value sequence before computing var(v) and var(diff(v)). Strips the quadratic-in-N denominator inflation that drift induces, exposing the true ratio of step-to-step jitter to fluctuation amplitude around the trend. Recommended for sources with strong monotone drift, where the no-detrend mobility is biased downward toward 0.',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        top?: string;
        sort: string;
        detrend?: boolean;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = ['mobility-asc', 'mobility-desc', 'rows', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenHjorthMobility(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          top,
          detrend: opts.detrend === true,
          sort: opts.sort as
            | 'mobility-asc'
            | 'mobility-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenHjorthMobility(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-hjorth-complexity')
  .description(
    "Per-source Hjorth Complexity (Hjorth 1970, EEG Clin. Neurophysiol. 29:306-310) on the per-row total_tokens time-ordered sequence. complexity = mobility(diff(v)) / mobility(v) = sqrt(var(ddv) * var(v)) / var(dv). Unitless. ~1 for single-tone / sinusoidal series (canonical sine: cos and -sin share frequency). >1 for multi-frequency / noise-like / spectrally spread series. <1 for first-difference-smoother-than-original (slowly modulated tones / chirps). Genuinely orthogonal to source-row-token-hjorth-mobility (mobility is the first spectral moment; complexity is the second — two sources with identical mobility can have very different complexities), to katz-fd / higuchi-fd (path-length geometric ratios), to dfa (cumulative-profile detrended scaling), to hurst-rs (R/S of cumulative deviations), to autocorrelation-lag1 (no closed-form identity because complexity carries lag-2 covariance via var(ddv)), to permutation-entropy / sample-entropy (ordinal / pattern-matching), to mann-kendall / runs / turning-point, to lempel-ziv / renyi-entropy (symbolic / histogrammatic), and to all order-invariant dispersion / shape lenses (shuffle changes complexity sharply).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n rows; integer >= 6 (default 24; complexity needs N-2 >= 4 for a stable second-diff variance)',
    '24',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'complexity-asc' (default; most single-tone / sinusoidal first) | 'complexity-desc' (most multi-tone / noise-like first) | 'rows' | 'source'",
    'complexity-asc',
  )
  .option(
    '--min-complexity <n>',
    'suppress sources whose computed complexity is strictly below this threshold; surfaces them under droppedBelowMinComplexity. Useful to hide the well-behaved sinusoidal-tail (complexity ~ 1) and surface only spectrally-spread / noise-like sources (complexity > 1.5 typical). Applied AFTER zero-variance / flat-diff / degenerate honest drops, so a source that fails to compute a complexity is still surfaced under its own drop counter.',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        top?: string;
        sort: string;
        minComplexity?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 6) {
          throw new Error(
            `--min-rows must be an integer >= 6 (got ${opts.minRows})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        let minComplexity: number | null = null;
        if (opts.minComplexity != null) {
          const mc = Number.parseFloat(opts.minComplexity);
          if (!Number.isFinite(mc) || mc < 0) {
            throw new Error(
              `--min-complexity must be a non-negative finite number (got ${opts.minComplexity})`,
            );
          }
          minComplexity = mc;
        }
        const validSorts = [
          'complexity-asc',
          'complexity-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenHjorthComplexity(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          top,
          minComplexity,
          sort: opts.sort as
            | 'complexity-asc'
            | 'complexity-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenHjorthComplexity(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-zero-crossing-rate')
  .description(
    "Per-source Zero-Crossing Rate (Kedem 1986, Proc. IEEE 74(11):1477-1493) of the de-meaned per-row total_tokens series. rate = (# adjacent sign changes after centring by mean) / (N - 1). Bounded in [0, 0.5] for any series whose centred sign sequence has at most one flip per step. Read: ~0 = slow drift / persistent; ~0.5 = Nyquist / white-noise-like / alternating. Genuinely orthogonal to hjorth-mobility/complexity (variance-ratio sensitive to amplitude; ZCR is amplitude-invariant after centring), to autocorrelation-lag1 (Kedem cosine identity holds for Gaussian only; token series are heavy-tailed), to runs / turning-point (no centring; monotone ramp has runs=1 / TP=0 but ZCR ~ 1/(N-1)), to permutation-entropy / sample-entropy (no embedding window), to lempel-ziv (mean-binarised transitions, not median-binarised factors), to dfa / hurst-rs / katz-fd / higuchi-fd (multi-scale exponents), and to all order-invariant dispersion / shape lenses (shuffle inflates ZCR toward 0.5).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n rows; integer >= 4 (default 24)',
    '24',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'rate-asc' (default; most slow-drift / persistent first) | 'rate-desc' (most Nyquist-like / alternating first) | 'rows' | 'source'",
    'rate-asc',
  )
  .option(
    '--min-rate <n>',
    'suppress sources whose ZCR is strictly below this threshold (in [0,1]); surfaces them under droppedBelowMinRate. Useful to surface only Nyquist-like / noise-like sources (>= 0.4 typical) and hide the persistent majority.',
  )
  .option(
    '--max-rate <n>',
    'suppress sources whose ZCR is strictly above this threshold (in [0,1]); surfaces them under droppedAboveMaxRate. Symmetric counterpart to --min-rate: surface only slow-drift / persistent sources (<= 0.2 typical).',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        top?: string;
        sort: string;
        minRate?: string;
        maxRate?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        let minRate: number | null = null;
        if (opts.minRate != null) {
          const v = Number.parseFloat(opts.minRate);
          if (!Number.isFinite(v) || v < 0 || v > 1) {
            throw new Error(
              `--min-rate must be a finite number in [0, 1] (got ${opts.minRate})`,
            );
          }
          minRate = v;
        }
        let maxRate: number | null = null;
        if (opts.maxRate != null) {
          const v = Number.parseFloat(opts.maxRate);
          if (!Number.isFinite(v) || v < 0 || v > 1) {
            throw new Error(
              `--max-rate must be a finite number in [0, 1] (got ${opts.maxRate})`,
            );
          }
          maxRate = v;
        }
        const validSorts = ['rate-asc', 'rate-desc', 'rows', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenZeroCrossingRate(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          top,
          minRate,
          maxRate,
          sort: opts.sort as 'rate-asc' | 'rate-desc' | 'rows' | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenZeroCrossingRate(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-petrosian-fd')
  .description(
    "Per-source Petrosian Fractal Dimension (Petrosian 1995, Proc. 8th IEEE Symp. CBMS, pp. 212-217) on the per-row total_tokens time-ordered sequence. PFD = log10(M) / (log10(M) + log10(M / (M + 0.4 * Nd))) where M = N - 1 and Nd = number of sign flips in diff(v) (zero diffs treated as +1, Esteller 2001 convention). Bounded in [1, 2]; ~1 = near-monotone; ~1.18 = Nyquist alternation. Genuinely orthogonal to katz-fd / higuchi-fd (metric path-length quantities; PFD is purely binary post-sign-mapping — multiply v by 13 and Nd is bit-identical), to zero-crossing-rate (counts mean-crossings of v; PFD counts sign flips of diff(v) — monotone ramp has ZCR ~ 1/(N-1) but PFD ~ 1), to turning-point-count (raw extrema count; PFD wraps it in length-normalised log-ratio so ranking does not preserve order), to runs-test-z (median-binarised over v, not diff sign), to mann-kendall (all-pair concordance), to autocorr-lag1 (linear, magnitude-sensitive), to hjorth-mobility/complexity (variance ratios — magnitude-sensitive), to permutation-entropy / sample-entropy (embedding windows), to lempel-ziv (median-binarised factor count), to renyi-entropy / dfa / hurst-rs, and to all order-invariant dispersion / shape lenses (shuffle inflates Nd / PFD).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n rows; integer >= 4 (default 16)',
    '16',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'pfd-asc' (default; smoothest first) | 'pfd-desc' (wiggliest first) | 'rows' | 'source'",
    'pfd-asc',
  )
  .option(
    '--zero-rule <mode>',
    "how to handle dv[i] == 0: 'positive' (default; zero -> +1, Esteller convention, matches 0.6.134 behaviour) | 'skip' (drop zero diffs entirely from the stream) | 'previous' (zero inherits the most recent non-zero sign; leading zeros dropped). Differs from 'positive' only on sources with long runs of repeated values; isolates non-flat diff structure.",
    'positive',
  )
  .option(
    '--min-pfd <v>',
    'filter out sources with PFD strictly below v (post-compute, pre-cap); v must be in [1, 2]; surfaces in droppedBelowMinPfd',
  )
  .option(
    '--max-pfd <v>',
    'filter out sources with PFD strictly above v (post-compute, pre-cap); v must be in [1, 2]; surfaces in droppedAboveMaxPfd',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        top?: string;
        sort: string;
        zeroRule: string;
        minPfd?: string;
        maxPfd?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = ['pfd-asc', 'pfd-desc', 'rows', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const validZeroRules = ['positive', 'skip', 'previous'];
        if (!validZeroRules.includes(opts.zeroRule)) {
          throw new Error(
            `--zero-rule must be one of ${validZeroRules.join('|')} (got ${opts.zeroRule})`,
          );
        }
        let minPfd: number | null = null;
        if (opts.minPfd != null) {
          const v = Number.parseFloat(opts.minPfd);
          if (!Number.isFinite(v) || v < 1 || v > 2) {
            throw new Error(`--min-pfd must be in [1, 2] (got ${opts.minPfd})`);
          }
          minPfd = v;
        }
        let maxPfd: number | null = null;
        if (opts.maxPfd != null) {
          const v = Number.parseFloat(opts.maxPfd);
          if (!Number.isFinite(v) || v < 1 || v > 2) {
            throw new Error(`--max-pfd must be in [1, 2] (got ${opts.maxPfd})`);
          }
          maxPfd = v;
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenPetrosianFd(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          top,
          zeroRule: opts.zeroRule as 'positive' | 'skip' | 'previous',
          minPfd,
          maxPfd,
          sort: opts.sort as 'pfd-asc' | 'pfd-desc' | 'rows' | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenPetrosianFd(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-lempel-ziv')
  .description(
    "Per-source Lempel-Ziv (LZ76) symbolic complexity (Lempel & Ziv 1976, IEEE Trans. IT 22(1):75-81) on the per-row total_tokens time-ordered sequence after a per-source median binarisation. Reports raw factor count c(N) and normalised lzNorm = c(N) * log2(N) / N (in (0, ~1]; ~1 for i.i.d. fair-coin, << 1 for periodic / monotone / repetitive series). Genuinely orthogonal to permutation-entropy (ordinal vs. binary multi-length factor count), to sample-entropy (single-scale tolerance-matched recurrence vs. binarised multi-length factors), to runs / turning-point (specific event counts), to mann-kendall (anti-correlated on monotone signals only), to lag-1 autocorrelation (linear, parametric, value-domain), to hurst-rs / higuchi-fd (power-law scaling of values vs. symbol-sequence richness), and to all order-invariant dispersion / shape lenses (shuffle-invariant; lzNorm typically changes under shuffle).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n rows; integer >= 2 (default 8)',
    '8',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'lznorm-asc' (default; most repetitive first) | 'lznorm-desc' | 'lz-asc' | 'lz-desc' | 'rows' | 'source'",
    'lznorm-asc',
  )
  .option(
    '--threshold <n>',
    'binarisation threshold. When set, s[i] = 1 if v[i] > threshold else 0 (absolute-band comparison across sources). When unset (default), the per-source median is used (balanced split, scale-invariant per source). Sources entirely above or below the threshold collapse to a constant bitstream and surface under droppedConstantBitstream.',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        top?: string;
        sort: string;
        threshold?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 2) {
          throw new Error(`--min-rows must be an integer >= 2 (got ${opts.minRows})`);
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        let threshold: number | null = null;
        if (opts.threshold != null) {
          const t = Number.parseFloat(opts.threshold);
          if (!Number.isFinite(t) || t < 0) {
            throw new Error(
              `--threshold must be a finite non-negative number (got ${opts.threshold})`,
            );
          }
          threshold = t;
        }
        const validSorts = [
          'lz-asc',
          'lz-desc',
          'lznorm-asc',
          'lznorm-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenLempelZiv(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          top,
          threshold,
          sort: opts.sort as
            | 'lz-asc'
            | 'lz-desc'
            | 'lznorm-asc'
            | 'lznorm-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRowTokenLempelZiv(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-renyi-entropy')
  .description(
    "Per-source Renyi entropy at alpha=2 (collision entropy) of the per-row total_tokens distribution, computed over an equal-width histogram on [min, max]. Reports h2 = -log2(sum p^2) in bits and normalised h2Norm = h2 / log2(support) in (0, 1]; h2Norm = 1 iff non-empty bins are equiprobable, h2Norm -> 0 as mass concentrates into one bin. Order-invariant complement to all order-sensitive lenses (lempel-ziv, permutation-entropy, sample-entropy, mann-kendall, runs, turning-point, autocorr-lag1, hurst-rs, higuchi-fd) and a histogram-based summary distinct from all moment / order-statistic shape lenses (gini, iqr-ratio, mad, skewness, kurtosis, burstiness-coefficient, coefficient-of-variation). Differs from Shannon (alpha=1) entropy: collision entropy is dominated by dominant bins; Shannon by rare bins.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n rows; integer >= 2 (default 8)',
    '8',
  )
  .option(
    '--bins <n>',
    'number of equal-width histogram bins per source; integer >= 2 (default 16)',
    '16',
  )
  .option(
    '--alpha <q>',
    'Renyi entropy order (>0, !=1). 2 = collision (default), small alpha (e.g. 0.5) emphasises rare bins, large alpha (e.g. 8) approaches min-entropy (dominant bin)',
    '2',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'h2norm-asc' (default; most concentrated first) | 'h2norm-desc' | 'h2-asc' | 'h2-desc' | 'rows' | 'source'",
    'h2norm-asc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        bins: string;
        alpha: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 2) {
          throw new Error(`--min-rows must be an integer >= 2 (got ${opts.minRows})`);
        }
        const bins = Number.parseInt(opts.bins, 10);
        if (!Number.isInteger(bins) || bins < 2) {
          throw new Error(`--bins must be an integer >= 2 (got ${opts.bins})`);
        }
        const alpha = Number.parseFloat(opts.alpha);
        if (!Number.isFinite(alpha) || alpha <= 0 || alpha === 1) {
          throw new Error(
            `--alpha must be a finite number > 0 and != 1 (got ${opts.alpha})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'h2-asc',
          'h2-desc',
          'h2norm-asc',
          'h2norm-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenRenyiEntropy(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          bins,
          alpha,
          top,
          sort: opts.sort as
            | 'h2-asc'
            | 'h2-desc'
            | 'h2norm-asc'
            | 'h2norm-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRowTokenRenyiEntropy(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );


program
  .command('source-row-token-dfa')
  .description(
    "Per-source DFA-1 alpha exponent (Peng et al. 1994, Phys. Rev. E 49:1685-1689) on the per-row total_tokens time-ordered sequence. Integrate v - mean to a cumulative profile Y, split into non-overlapping windows of size s, OLS-detrend each window, take the rms residual F(s); alpha is the OLS slope of log F(s) vs log s. alpha ~ 0.5 = uncorrelated noise; alpha < 0.5 = anti-persistent; 0.5 < alpha < 1 = persistent / long-range positive correlations; alpha = 1 = 1/f noise; alpha = 1.5 = Brownian; alpha > 1.5 = drift-dominated. Genuinely orthogonal to source-row-token-hurst-rs (no detrending of cumulative deviations vs. local linear detrending of cumulative profile - coincide only for trend-free fBm), to source-row-token-higuchi-fd (arc length on raw values vs. detrended fluctuation on cumulative profile - opposite ends of the integration ladder), to permutation-entropy / sample-entropy / lempel-ziv (ordinal / single-scale tolerance / symbolic vs. multi-scale value-domain), to mann-kendall / runs / turning-point (directional / dichotomy / extremum), to autocorr-lag1 (single-lag linear), to renyi-entropy (order-invariant histogram), and to all order-invariant dispersion / shape lenses.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--scale-min <n>',
    'minimum window size s (integer >= 4). (default 4)',
    '4',
  )
  .option(
    '--scale-max <n>',
    'maximum window size s. If omitted, defaults to floor(N/4) per source. Integer >= scale-min*2.',
  )
  .option(
    '--min-scales <n>',
    'minimum number of usable scales required to estimate alpha. Integer >= 3. (default 4)',
    '4',
  )
  .option(
    '--min-windows-per-scale <n>',
    'minimum number of windows per scale required for that scale to enter the regression. Integer >= 2. (default 4)',
    '4',
  )
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n rows; integer >= 4*scale-min. (default 32)',
    '32',
  )
  .option(
    '--detrend-order <p>',
    "polynomial order p for the per-window detrend. p=1 is DFA-1 (linear, the canonical Peng 1994 default); p=2 is DFA-2 (quadratic — also removes local curvature); p=3 is DFA-3 (cubic). Higher orders are sensitive to higher-order non-stationarity and are genuinely orthogonal to DFA-1 on series with curvature (a sinusoidal modulation will be partially absorbed by DFA-2 but not DFA-1). Requires scale-min >= p + 2. Integer in [1, 3]. (default 1)",
    '1',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'alpha-asc' (default; most anti-persistent first) | 'alpha-desc' (drift-dominated first) | 'rows' | 'source'",
    'alpha-asc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        scaleMin: string;
        scaleMax?: string;
        minScales: string;
        minWindowsPerScale: string;
        minRows: string;
        detrendOrder: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const scaleMin = Number.parseInt(opts.scaleMin, 10);
        if (!Number.isInteger(scaleMin) || scaleMin < 4) {
          throw new Error(`--scale-min must be an integer >= 4 (got ${opts.scaleMin})`);
        }
        let scaleMax: number | null = null;
        if (opts.scaleMax != null) {
          const sm = Number.parseInt(opts.scaleMax, 10);
          if (!Number.isInteger(sm) || sm < scaleMin * 2) {
            throw new Error(
              `--scale-max must be an integer >= scale-min*2 (=${scaleMin * 2}) (got ${opts.scaleMax})`,
            );
          }
          scaleMax = sm;
        }
        const minScales = Number.parseInt(opts.minScales, 10);
        if (!Number.isInteger(minScales) || minScales < 3) {
          throw new Error(
            `--min-scales must be an integer >= 3 (got ${opts.minScales})`,
          );
        }
        const minWindowsPerScale = Number.parseInt(opts.minWindowsPerScale, 10);
        if (!Number.isInteger(minWindowsPerScale) || minWindowsPerScale < 2) {
          throw new Error(
            `--min-windows-per-scale must be an integer >= 2 (got ${opts.minWindowsPerScale})`,
          );
        }
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4 * scaleMin) {
          throw new Error(
            `--min-rows must be an integer >= 4*scale-min (=${4 * scaleMin}) (got ${opts.minRows})`,
          );
        }
        const detrendOrder = Number.parseInt(opts.detrendOrder, 10);
        if (!Number.isInteger(detrendOrder) || detrendOrder < 1 || detrendOrder > 3) {
          throw new Error(
            `--detrend-order must be an integer in [1, 3] (got ${opts.detrendOrder})`,
          );
        }
        if (scaleMin < detrendOrder + 2) {
          throw new Error(
            `--scale-min must be >= --detrend-order + 2 (=${detrendOrder + 2}) (got scale-min=${scaleMin})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = ['alpha-asc', 'alpha-desc', 'rows', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenDfa(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          scaleMin,
          scaleMax,
          minScales,
          minWindowsPerScale,
          minRows,
          detrendOrder,
          top,
          sort: opts.sort as 'alpha-asc' | 'alpha-desc' | 'rows' | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRowTokenDfa(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-approximate-entropy')
  .description(
    "Per-source Approximate Entropy (Pincus 1991, PNAS 88(6):2297-2301) on the per-row total_tokens time-ordered sequence. ApEn(m, r) = phi^m - phi^(m+1) where phi^k = mean over i of ln(C_i^k) and C_i^k is the fraction of length-k templates within Chebyshev distance r*sigma of template i (self-matches included). Lower = more regular, higher = more random. White noise typically ~ 1.6-2.1 at m=2, r=0.2; perfectly periodic ~ 0. Genuinely orthogonal to source-row-token-sample-entropy (SampEn excludes self-matches and is undefined for no-match degeneracies; ApEn is biased toward regularity but always finite for non-constant series), to permutation-entropy (ordinal-only), to hurst-rs / dfa (multi-scale memory), to mann-kendall / runs / turning-point (directional / dichotomy / extremum), to lag-1 autocorrelation (linear, single lag), to lempel-ziv (median-binarised factors), to katz-fd / higuchi-fd / petrosian-fd (path-length / FD), to hjorth-mobility/complexity (variance ratios), to zero-crossing-rate (sign count), and to all order-invariant dispersion / shape lenses.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option('--m <n>', 'embedding dimension; integer in [1, 6] (default 2)', '2')
  .option('--r <n>', 'tolerance multiplier r (tolerance = r * sigma_v); finite positive (default 0.2)', '0.2')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n rows; integer >= m+2 (default 12)',
    '12',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'apen-asc' (default; most-regular first) | 'apen-desc' (most-random first) | 'rows' | 'source'",
    'apen-asc',
  )
  .option(
    '--min-apen <n>',
    'suppress sources whose ApEn is strictly below this threshold; surfaces them under droppedBelowMinApen. Useful to surface only high-irregularity sources (e.g. >= 0.8) and hide regular majority.',
  )
  .option(
    '--max-apen <n>',
    'suppress sources whose ApEn is strictly above this threshold; surfaces them under droppedAboveMaxApen. Symmetric to --min-apen: surface only the most-regular sources.',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        m: string;
        r: string;
        minRows: string;
        top?: string;
        sort: string;
        minApen?: string;
        maxApen?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const m = Number.parseInt(opts.m, 10);
        if (!Number.isInteger(m) || m < 1 || m > 6) {
          throw new Error(`--m must be an integer in [1, 6] (got ${opts.m})`);
        }
        const r = Number.parseFloat(opts.r);
        if (!Number.isFinite(r) || r <= 0) {
          throw new Error(`--r must be a finite positive number (got ${opts.r})`);
        }
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < m + 2) {
          throw new Error(
            `--min-rows must be an integer >= m+2 (=${m + 2}) (got ${opts.minRows})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        let minApen: number | null = null;
        if (opts.minApen != null) {
          const v = Number.parseFloat(opts.minApen);
          if (!Number.isFinite(v)) {
            throw new Error(`--min-apen must be a finite number (got ${opts.minApen})`);
          }
          minApen = v;
        }
        let maxApen: number | null = null;
        if (opts.maxApen != null) {
          const v = Number.parseFloat(opts.maxApen);
          if (!Number.isFinite(v)) {
            throw new Error(`--max-apen must be a finite number (got ${opts.maxApen})`);
          }
          maxApen = v;
        }
        const validSorts = ['apen-asc', 'apen-desc', 'rows', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenApproximateEntropy(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          m,
          r,
          minRows,
          top,
          minApen,
          maxApen,
          sort: opts.sort as 'apen-asc' | 'apen-desc' | 'rows' | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenApproximateEntropy(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-teager-kaiser')
  .description(
    "Per-source mean Teager-Kaiser Energy Operator (Kaiser 1990, ICASSP-90 vol.1 pp.381-384) on the per-row total_tokens time-ordered sequence. psi(x_n) = x_n^2 - x_{n-1} * x_{n+1}; for x_n = A cos(omega n + phi) yields ~ A^2 * sin^2(omega), simultaneously coupling local amplitude AND frequency in a single 3-point computation. Distinct from variance (psi is a 3-point cross product, not a centered second moment), from autocorrelation (non-linear, three samples), from hjorth-mobility/complexity (variance ratios on differences, not energy products), from entropy/fractal/ordinal lenses (TKEO is a deterministic real-valued energy, not an information-theoretic or scaling quantity), and from all order-invariant dispersion / shape lenses (TKEO is annihilated by reordering). Optional --normalize divides by sigma^2 to yield an amplitude-invariant proxy for instantaneous frequency-squared.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n rows; integer >= 3 (default 8)',
    '8',
  )
  .option(
    '--normalize',
    'divide tkeoMean by sigma^2 (amplitude-invariant proxy for instantaneous frequency-squared); affects sort key when sort is tkeo-asc/tkeo-desc',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--min-tkeo <n>',
    'suppress sources whose computed value is strictly below this threshold; surfaces them under droppedBelowMinTkeo. With --normalize, applies to tkeoMeanNormalized; otherwise to tkeoMean.',
  )
  .option(
    '--max-tkeo <n>',
    'suppress sources whose computed value is strictly above this threshold; surfaces them under droppedAboveMaxTkeo. Symmetric to --min-tkeo.',
  )
  .option(
    '--sort <key>',
    "sort key: 'tkeo-asc' (default; quietest first) | 'tkeo-desc' (most-energetic first) | 'abs-asc' (smallest |tkeo| first) | 'abs-desc' (largest |tkeo| first) | 'rows' | 'source'. With --normalize, the sort key uses tkeoMeanNormalized.",
    'tkeo-asc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        normalize?: boolean;
        top?: string;
        minTkeo?: string;
        maxTkeo?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 3) {
          throw new Error(
            `--min-rows must be an integer >= 3 (got ${opts.minRows})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        let minTkeo: number | null = null;
        if (opts.minTkeo != null) {
          const v = Number.parseFloat(opts.minTkeo);
          if (!Number.isFinite(v)) {
            throw new Error(`--min-tkeo must be a finite number (got ${opts.minTkeo})`);
          }
          minTkeo = v;
        }
        let maxTkeo: number | null = null;
        if (opts.maxTkeo != null) {
          const v = Number.parseFloat(opts.maxTkeo);
          if (!Number.isFinite(v)) {
            throw new Error(`--max-tkeo must be a finite number (got ${opts.maxTkeo})`);
          }
          maxTkeo = v;
        }
        const validSorts = ['tkeo-asc', 'tkeo-desc', 'abs-asc', 'abs-desc', 'rows', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenTeagerKaiser(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          normalize: opts.normalize ?? false,
          top,
          minTkeo,
          maxTkeo,
          sort: opts.sort as 'tkeo-asc' | 'tkeo-desc' | 'abs-asc' | 'abs-desc' | 'rows' | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenTeagerKaiser(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-crest-factor')
  .description(
    "Per-source crest factor C = peak / rms on the per-row total_tokens sequence. C is bounded in [1, sqrt(n)]: 1 means perfectly flat positive, sqrt(n) means one nonzero sample among n-1 zeros. Distinct from cv (centered dispersion), burstiness-coefficient (bounded sigma-vs-mu ratio), fano-factor (variance/mean), kurtosis/skewness (centered shape moments), order-sensitive lenses (TKEO/hjorth/autocorrelation/zcr/runs-test/turning-point/mann-kendall) and entropy/fractal/lempel-ziv lenses. crestFactorNorm = (C - 1) / (sqrt(n) - 1) puts heterogeneous-n sources on the same [0, 1] scale.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n rows; integer >= 2 (default 4)',
    '4',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--min-crest <n>',
    'suppress sources whose crestFactor is strictly below this threshold; surfaces them under droppedBelowMinCrest. Useful to surface only the peakier sources.',
  )
  .option(
    '--max-crest <n>',
    'suppress sources whose crestFactor is strictly above this threshold; surfaces them under droppedAboveMaxCrest. Symmetric to --min-crest; useful to surface flatter sources for diagnostics.',
  )
  .option(
    '--sort <key>',
    "sort key: 'crest-asc' (default; least peaky first) | 'crest-desc' (most peaky first) | 'norm-asc' | 'norm-desc' | 'rows' | 'source'",
    'crest-asc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        top?: string;
        minCrest?: string;
        maxCrest?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 2) {
          throw new Error(
            `--min-rows must be an integer >= 2 (got ${opts.minRows})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        let minCrest: number | null = null;
        if (opts.minCrest != null) {
          const v = Number.parseFloat(opts.minCrest);
          if (!Number.isFinite(v)) {
            throw new Error(`--min-crest must be a finite number (got ${opts.minCrest})`);
          }
          minCrest = v;
        }
        let maxCrest: number | null = null;
        if (opts.maxCrest != null) {
          const v = Number.parseFloat(opts.maxCrest);
          if (!Number.isFinite(v)) {
            throw new Error(`--max-crest must be a finite number (got ${opts.maxCrest})`);
          }
          maxCrest = v;
        }
        const validSorts = ['crest-asc', 'crest-desc', 'norm-asc', 'norm-desc', 'rows', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenCrestFactor(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          top,
          minCrest,
          maxCrest,
          sort: opts.sort as 'crest-asc' | 'crest-desc' | 'norm-asc' | 'norm-desc' | 'rows' | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenCrestFactor(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-spectral-flatness')
  .description(
    "Per-source spectral flatness SF = G(P)/A(P) (Wiener entropy; Johnston 1988) of the one-sided non-DC power spectrum of the mean-centered per-row total_tokens series. SF in (0, 1]: 1 = white-noise-like (uniform PSD); -> 0 = highly tonal/periodic. Frequency-domain functional, orthogonal to amplitude-shape lenses (crest-factor, gini, mad, iqr-ratio, cv, kurtosis, skewness, burstiness-coefficient), to spectral *moments* (TKEO, hjorth-mobility/complexity), to single-lag autocorrelation, to event-count lenses (zcr, runs-test, turning-point, mann-kendall), to time-domain symbolic entropies (approximate, sample, permutation, renyi), and to scaling/fractal lenses (hurst-rs, dfa, higuchi-fd, katz-fd, petrosian-fd).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n rows; integer >= 4 (default 8)',
    '8',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--min-sf <n>',
    'suppress sources whose spectralFlatness is strictly below this threshold; surfaces them under droppedBelowMinSf. Useful to surface only the more white-noise-like sources.',
  )
  .option(
    '--max-sf <n>',
    'suppress sources whose spectralFlatness is strictly above this threshold; surfaces them under droppedAboveMaxSf. Symmetric to --min-sf; useful to surface the more tonal sources.',
  )
  .option(
    '--sort <key>',
    "sort key: 'sf-asc' (default; most tonal first) | 'sf-desc' (most white-noise-like first) | 'rows' | 'source'",
    'sf-asc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        top?: string;
        minSf?: string;
        maxSf?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        let minSf: number | null = null;
        if (opts.minSf != null) {
          const v = Number.parseFloat(opts.minSf);
          if (!Number.isFinite(v)) {
            throw new Error(`--min-sf must be a finite number (got ${opts.minSf})`);
          }
          minSf = v;
        }
        let maxSf: number | null = null;
        if (opts.maxSf != null) {
          const v = Number.parseFloat(opts.maxSf);
          if (!Number.isFinite(v)) {
            throw new Error(`--max-sf must be a finite number (got ${opts.maxSf})`);
          }
          maxSf = v;
        }
        const validSorts = ['sf-asc', 'sf-desc', 'rows', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenSpectralFlatness(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          top,
          minSf,
          maxSf,
          sort: opts.sort as 'sf-asc' | 'sf-desc' | 'rows' | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenSpectralFlatness(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-spectral-rolloff')
  .description(
    "Per-source spectral roll-off frequency (rolloffBin = smallest k where cumulative one-sided non-DC power crosses --rolloff-fraction; default 0.85). McKinney & Breebaart 2003 / Klapuri 1999. PSD *quantile* of the mean-centered per-row total_tokens series. Reports rolloffBin, rolloffFractionBins (= rolloffBin / floor(n/2), scale-free band-edge), realised cumulativeFraction, dominantBin, and dominantBinShare. Frequency-domain functional, orthogonal to spectral-flatness (entropy ratio of the same PSD), to spectral *moments* (TKEO, hjorth-mobility/complexity), to single-lag autocorrelation, to event-count lenses (zcr, runs-test, turning-point, mann-kendall), to time-domain symbolic entropies (approximate, sample, permutation, renyi), to scaling/fractal lenses (hurst-rs, dfa, higuchi-fd, katz-fd, petrosian-fd), and to all amplitude-domain shape lenses (crest-factor, gini, mad, iqr-ratio, cv, kurtosis, skewness, burstiness-coefficient).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n rows; integer >= 4 (default 8)',
    '8',
  )
  .option(
    '--rolloff-fraction <f>',
    'cumulative-energy fraction at which to read the roll-off bin; in (0, 1] (default 0.85)',
    '0.85',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--min-rolloff-frac-bins <v>',
    'suppress sources whose rolloffFractionBins is strictly below this threshold; surfaces them under droppedBelowMinRolloffFracBins. Useful to surface only the more high-frequency-loaded sources.',
  )
  .option(
    '--max-rolloff-frac-bins <v>',
    'suppress sources whose rolloffFractionBins is strictly above this threshold; surfaces them under droppedAboveMaxRolloffFracBins. Symmetric to --min-rolloff-frac-bins; useful to surface only the more low-frequency-loaded sources.',
  )
  .option(
    '--sort <key>',
    "sort key: 'rolloff-asc' (default; most low-frequency-loaded first) | 'rolloff-desc' (most high-frequency-loaded first) | 'rows' | 'source'",
    'rolloff-asc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        rolloffFraction: string;
        top?: string;
        minRolloffFracBins?: string;
        maxRolloffFracBins?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        const rolloffFraction = Number.parseFloat(opts.rolloffFraction);
        if (
          !Number.isFinite(rolloffFraction) ||
          rolloffFraction <= 0 ||
          rolloffFraction > 1
        ) {
          throw new Error(
            `--rolloff-fraction must be in (0, 1] (got ${opts.rolloffFraction})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        let minRolloffFracBins: number | null = null;
        if (opts.minRolloffFracBins != null) {
          const v = Number.parseFloat(opts.minRolloffFracBins);
          if (!Number.isFinite(v)) {
            throw new Error(
              `--min-rolloff-frac-bins must be a finite number (got ${opts.minRolloffFracBins})`,
            );
          }
          minRolloffFracBins = v;
        }
        let maxRolloffFracBins: number | null = null;
        if (opts.maxRolloffFracBins != null) {
          const v = Number.parseFloat(opts.maxRolloffFracBins);
          if (!Number.isFinite(v)) {
            throw new Error(
              `--max-rolloff-frac-bins must be a finite number (got ${opts.maxRolloffFracBins})`,
            );
          }
          maxRolloffFracBins = v;
        }
        const validSorts = ['rolloff-asc', 'rolloff-desc', 'rows', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenSpectralRolloff(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          rolloffFraction,
          top,
          minRolloffFracBins,
          maxRolloffFracBins,
          sort: opts.sort as
            | 'rolloff-asc'
            | 'rolloff-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenSpectralRolloff(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-spectral-centroid')
  .description(
    "Per-source spectral centroid (first moment of the one-sided non-DC PSD) of the mean-centered per-row total_tokens series. centroidBin = sum(k * P[k]) / sum(P[k]); centroidFractionBins = centroidBin / floor(n/2) is a scale-free brightness in fraction-of-Nyquist units. Klapuri 1999 / McKinney & Breebaart 2003. PSD *first moment* (mean of CDF), genuinely orthogonal to spectral-rolloff (CDF *quantile*), spectral-flatness (entropy ratio), hjorth-mobility (sqrt of *second* moment), TKEO, single-lag autocorrelation, event-count lenses (zcr, runs-test, turning-point, mann-kendall), time-domain symbolic entropies (approximate, sample, permutation, renyi, lempel-ziv), scaling/fractal lenses (hurst-rs, dfa, higuchi-fd, katz-fd, petrosian-fd), and amplitude-domain shape lenses (crest-factor, gini, mad, iqr-ratio, cv, kurtosis, skewness, burstiness-coefficient).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n rows; integer >= 4 (default 8)',
    '8',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--min-centroid-frac-bins <v>',
    'suppress sources whose centroidFractionBins is strictly below this threshold; surfaces them under droppedBelowMinCentroidFracBins. Useful to surface only the more high-frequency-loaded sources.',
  )
  .option(
    '--max-centroid-frac-bins <v>',
    'suppress sources whose centroidFractionBins is strictly above this threshold; surfaces them under droppedAboveMaxCentroidFracBins. Symmetric to --min-centroid-frac-bins; useful to surface only the more low-frequency-loaded sources.',
  )
  .option(
    '--sort <key>',
    "sort key: 'centroid-asc' (default; most low-frequency-loaded first) | 'centroid-desc' (most high-frequency-loaded first) | 'rows' | 'source'",
    'centroid-asc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        top?: string;
        minCentroidFracBins?: string;
        maxCentroidFracBins?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        let minCentroidFracBins: number | null = null;
        if (opts.minCentroidFracBins != null) {
          const v = Number.parseFloat(opts.minCentroidFracBins);
          if (!Number.isFinite(v)) {
            throw new Error(
              `--min-centroid-frac-bins must be a finite number (got ${opts.minCentroidFracBins})`,
            );
          }
          minCentroidFracBins = v;
        }
        let maxCentroidFracBins: number | null = null;
        if (opts.maxCentroidFracBins != null) {
          const v = Number.parseFloat(opts.maxCentroidFracBins);
          if (!Number.isFinite(v)) {
            throw new Error(
              `--max-centroid-frac-bins must be a finite number (got ${opts.maxCentroidFracBins})`,
            );
          }
          maxCentroidFracBins = v;
        }
        const validSorts = ['centroid-asc', 'centroid-desc', 'rows', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenSpectralCentroid(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          top,
          minCentroidFracBins,
          maxCentroidFracBins,
          sort: opts.sort as
            | 'centroid-asc'
            | 'centroid-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenSpectralCentroid(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-spectral-bandwidth')
  .description(
    "Per-source spectral bandwidth (sqrt of the 2nd central moment of the one-sided non-DC PSD around its centroid) of the mean-centered per-row total_tokens series. bandwidthBin = sqrt(sum_k (k - c)^2 * P[k] / sum_k P[k]); bandwidthFractionBins = bandwidthBin / floor(n/2). Klapuri 1999 / Peeters 2004 (CUIDADO §6.1, spectral spread). PSD *2nd central moment* (spread around centroid), genuinely orthogonal to spectral-centroid (1st moment / location), spectral-rolloff (CDF quantile), spectral-flatness (entropy ratio), hjorth-mobility (sqrt of *non-central* 2nd moment), TKEO, single-lag autocorrelation, event-count lenses, time-domain symbolic entropies, scaling/fractal lenses, and amplitude-domain shape lenses.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n rows; integer >= 4 (default 8)',
    '8',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--min-bandwidth-frac-bins <v>',
    'suppress sources whose bandwidthFractionBins is strictly below this threshold; surfaces them under droppedBelowMinBandwidthFracBins. Useful to surface only the more spectrally spread sources.',
  )
  .option(
    '--max-bandwidth-frac-bins <v>',
    'suppress sources whose bandwidthFractionBins is strictly above this threshold; surfaces them under droppedAboveMaxBandwidthFracBins. Symmetric to --min-bandwidth-frac-bins; useful to surface only the more spectrally concentrated sources.',
  )
  .option(
    '--sort <key>',
    "sort key: 'bandwidth-asc' (default; most spectrally concentrated first) | 'bandwidth-desc' (most spectrally spread first) | 'rows' | 'source'",
    'bandwidth-asc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        top?: string;
        minBandwidthFracBins?: string;
        maxBandwidthFracBins?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        let minBandwidthFracBins: number | null = null;
        if (opts.minBandwidthFracBins != null) {
          const v = Number.parseFloat(opts.minBandwidthFracBins);
          if (!Number.isFinite(v)) {
            throw new Error(
              `--min-bandwidth-frac-bins must be a finite number (got ${opts.minBandwidthFracBins})`,
            );
          }
          minBandwidthFracBins = v;
        }
        let maxBandwidthFracBins: number | null = null;
        if (opts.maxBandwidthFracBins != null) {
          const v = Number.parseFloat(opts.maxBandwidthFracBins);
          if (!Number.isFinite(v)) {
            throw new Error(
              `--max-bandwidth-frac-bins must be a finite number (got ${opts.maxBandwidthFracBins})`,
            );
          }
          maxBandwidthFracBins = v;
        }
        const validSorts = ['bandwidth-asc', 'bandwidth-desc', 'rows', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenSpectralBandwidth(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          top,
          minBandwidthFracBins,
          maxBandwidthFracBins,
          sort: opts.sort as
            | 'bandwidth-asc'
            | 'bandwidth-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenSpectralBandwidth(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-spectral-skewness')
  .description(
    "Per-source standardized (Fisher) spectral skewness (3rd standardized central moment of the one-sided non-DC PSD around its centroid) of the mean-centered per-row total_tokens series. skewness = m3 / m2^(3/2). Sign tells which side of the centroid the PSD tail leans (positive => high-frequency tail; negative => low-frequency tail). Peeters 2004 / Lerch 2012 / Joanes & Gill 1998. PSD *3rd standardized central moment* (asymmetry around centroid), genuinely orthogonal to spectral-centroid (1st moment / location), spectral-bandwidth (2nd central moment / spread; standardization by m2^(3/2) deliberately strips spread out so only direction remains), spectral-rolloff, spectral-flatness, hjorth-mobility (sign-blind), TKEO, single-lag autocorrelation, event-count lenses, time-domain symbolic entropies, scaling/fractal lenses, and amplitude-domain shape lenses (which are order-invariant; this lens is order-sensitive).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n rows; integer >= 4 (default 8)',
    '8',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--min-skewness <v>',
    'suppress sources whose standardized skewness is strictly below this threshold; surfaces them under droppedBelowMinSkewness. Useful to surface only PSDs leaning sufficiently towards the high-frequency tail.',
  )
  .option(
    '--max-skewness <v>',
    'suppress sources whose standardized skewness is strictly above this threshold; surfaces them under droppedAboveMaxSkewness. Symmetric to --min-skewness; useful to surface only PSDs leaning towards the low-frequency tail.',
  )
  .option(
    '--min-bw-bin <v>',
    'suppress sources whose bandwidthBin (sqrt of m2, bin-units) is strictly below this threshold; surfaces them under droppedBelowMinBandwidthBin. Useful to avoid reading skewness off near-degenerate (almost-zero-variance) PSDs where the standardized 3rd moment is numerically fragile.',
  )
  .option(
    '--max-bw-bin <v>',
    'suppress sources whose bandwidthBin is strictly above this threshold; surfaces them under droppedAboveMaxBandwidthBin. Symmetric to --min-bw-bin.',
  )
  .option(
    '--sort <key>',
    "sort key: 'skewness-asc' (default; most negatively skewed / long low-frequency tail first) | 'skewness-desc' (most positively skewed / long high-frequency tail first) | 'abs-skewness-desc' (most asymmetric in either direction first) | 'rows' | 'source'",
    'skewness-asc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        top?: string;
        minSkewness?: string;
        maxSkewness?: string;
        minBwBin?: string;
        maxBwBin?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        let minSkewness: number | null = null;
        if (opts.minSkewness != null) {
          const v = Number.parseFloat(opts.minSkewness);
          if (!Number.isFinite(v)) {
            throw new Error(
              `--min-skewness must be a finite number (got ${opts.minSkewness})`,
            );
          }
          minSkewness = v;
        }
        let maxSkewness: number | null = null;
        if (opts.maxSkewness != null) {
          const v = Number.parseFloat(opts.maxSkewness);
          if (!Number.isFinite(v)) {
            throw new Error(
              `--max-skewness must be a finite number (got ${opts.maxSkewness})`,
            );
          }
          maxSkewness = v;
        }
        let minBandwidthBin: number | null = null;
        if (opts.minBwBin != null) {
          const v = Number.parseFloat(opts.minBwBin);
          if (!Number.isFinite(v) || v < 0) {
            throw new Error(
              `--min-bw-bin must be a finite number >= 0 (got ${opts.minBwBin})`,
            );
          }
          minBandwidthBin = v;
        }
        let maxBandwidthBin: number | null = null;
        if (opts.maxBwBin != null) {
          const v = Number.parseFloat(opts.maxBwBin);
          if (!Number.isFinite(v) || v < 0) {
            throw new Error(
              `--max-bw-bin must be a finite number >= 0 (got ${opts.maxBwBin})`,
            );
          }
          maxBandwidthBin = v;
        }
        const validSorts = [
          'skewness-asc',
          'skewness-desc',
          'abs-skewness-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenSpectralSkewness(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          top,
          minSkewness,
          maxSkewness,
          minBandwidthBin,
          maxBandwidthBin,
          sort: opts.sort as
            | 'skewness-asc'
            | 'skewness-desc'
            | 'abs-skewness-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenSpectralSkewness(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-spectral-kurtosis')
  .description(
    "Per-source standardized spectral kurtosis (4th standardized central moment of the one-sided non-DC PSD around its centroid) of the mean-centered per-row total_tokens series. kurtosis = m4 / m2^2 (Pearson; always >= 1); excess = kurtosis - 3 (Fisher; Gaussian baseline 0). Large excess => leptokurtic (sharply peaked PSD with heavy tails); negative excess => platykurtic (flatter-topped). Antoni 2006 / Peeters 2004 / Lerch 2012 / Joanes & Gill 1998. PSD *4th standardized central moment* (peakedness/tail-weight, sign-blind, location-blind, scale-blind), genuinely orthogonal to spectral-skewness (3rd standardized central moment / asymmetry — sign-bearing), spectral-bandwidth (2nd central moment / spread — standardization by m2^2 strips spread out so only shape remains), spectral-centroid (1st moment / location — kurtosis is location-blind), spectral-rolloff, spectral-flatness, hjorth-mobility (sign-blind), TKEO, single-lag autocorrelation, event-count lenses, time-domain symbolic entropies, scaling/fractal lenses, and amplitude-domain shape lenses (which are order-invariant; this lens is order-sensitive).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n rows; integer >= 4 (default 8)',
    '8',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--min-kurtosis <v>',
    'suppress sources whose Pearson kurtosis is strictly below this threshold; surfaces them under droppedBelowMinKurtosis. Note kurtosis is always >= 1 by Cauchy-Schwarz, so --min-kurtosis 1 is a no-op.',
  )
  .option(
    '--max-kurtosis <v>',
    'suppress sources whose Pearson kurtosis is strictly above this threshold; surfaces them under droppedAboveMaxKurtosis. Symmetric to --min-kurtosis.',
  )
  .option(
    '--min-excess <v>',
    'suppress sources whose Fisher excess kurtosis (kurtosis - 3) is strictly below this threshold; surfaces them under droppedBelowMinExcess. Operator-friendly: --min-excess 0 isolates leptokurtic PSDs (sharper-than-Gaussian).',
  )
  .option(
    '--max-excess <v>',
    'suppress sources whose Fisher excess kurtosis is strictly above this threshold; surfaces them under droppedAboveMaxExcess. Operator-friendly: --max-excess 0 isolates platykurtic PSDs (flatter-than-Gaussian).',
  )
  .option(
    '--sort <key>',
    "sort key: 'excess-desc' (default; most leptokurtic — sharpest peaks / heaviest tails relative to Gaussian first) | 'excess-asc' (most platykurtic first) | 'kurtosis-desc' | 'kurtosis-asc' | 'abs-excess-desc' (furthest from Gaussian-shaped PSD in either direction first) | 'rows' | 'source'",
    'excess-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        top?: string;
        minKurtosis?: string;
        maxKurtosis?: string;
        minExcess?: string;
        maxExcess?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        let minKurtosis: number | null = null;
        if (opts.minKurtosis != null) {
          const v = Number.parseFloat(opts.minKurtosis);
          if (!Number.isFinite(v)) {
            throw new Error(
              `--min-kurtosis must be a finite number (got ${opts.minKurtosis})`,
            );
          }
          minKurtosis = v;
        }
        let maxKurtosis: number | null = null;
        if (opts.maxKurtosis != null) {
          const v = Number.parseFloat(opts.maxKurtosis);
          if (!Number.isFinite(v)) {
            throw new Error(
              `--max-kurtosis must be a finite number (got ${opts.maxKurtosis})`,
            );
          }
          maxKurtosis = v;
        }
        let minExcess: number | null = null;
        if (opts.minExcess != null) {
          const v = Number.parseFloat(opts.minExcess);
          if (!Number.isFinite(v)) {
            throw new Error(
              `--min-excess must be a finite number (got ${opts.minExcess})`,
            );
          }
          minExcess = v;
        }
        let maxExcess: number | null = null;
        if (opts.maxExcess != null) {
          const v = Number.parseFloat(opts.maxExcess);
          if (!Number.isFinite(v)) {
            throw new Error(
              `--max-excess must be a finite number (got ${opts.maxExcess})`,
            );
          }
          maxExcess = v;
        }
        const validSorts = [
          'kurtosis-asc',
          'kurtosis-desc',
          'excess-asc',
          'excess-desc',
          'abs-excess-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenSpectralKurtosis(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          top,
          minKurtosis,
          maxKurtosis,
          minExcess,
          maxExcess,
          sort: opts.sort as
            | 'kurtosis-asc'
            | 'kurtosis-desc'
            | 'excess-asc'
            | 'excess-desc'
            | 'abs-excess-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenSpectralKurtosis(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-spectral-entropy')
  .description(
    "Per-source Shannon entropy of the normalized one-sided non-DC PSD p[k] = P[k] / sum_j P[j] of the mean-centered per-row total_tokens series. entropyBits = -sum p[k] * log2(p[k]); entropyNorm = entropyBits / log2(bins) in [0, 1]. 0 = pure tone (all power in one bin); 1 = uniform PSD (white-on-band). Shannon 1948 / Inouye et al. 1991 / Rezek & Roberts 1998 / Pan, Chen & Hsieh 2009. Information-theoretic concentration summary on the normalized PSD, genuinely orthogonal to spectral-flatness (geometric/arithmetic ratio G/A — disagrees on PSDs with sparse zero bins and on intermediate distributions), spectral-bandwidth (2nd central moment / spread), spectral-kurtosis (4th standardized central moment / peakedness), spectral-skewness (sign-bearing asymmetry), spectral-centroid (location), spectral-rolloff, hjorth-mobility, TKEO, single-lag autocorrelation, event counters, time-domain symbolic entropies (count motifs in the sequence; spectral entropy counts how many bins participate in the PSD), scaling/fractal lenses, and all amplitude-domain shape lenses (this lens is order-sensitive; amplitude entropy is order-invariant).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n rows; integer >= 4 (default 8)',
    '8',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--min-norm-entropy <v>',
    'suppress sources whose entropyNorm is strictly below this threshold; surfaces them under droppedBelowMinNormEntropy. Operator-friendly: --min-norm-entropy 0.85 isolates the broadband / near-white subset.',
  )
  .option(
    '--max-norm-entropy <v>',
    'suppress sources whose entropyNorm is strictly above this threshold; surfaces them under droppedAboveMaxNormEntropy. Operator-friendly: --max-norm-entropy 0.5 isolates the tonal / concentrated subset.',
  )
  .option(
    '--sort <key>',
    "sort key: 'norm-desc' (default; most broadband / white-like first) | 'norm-asc' (most tonal / concentrated first) | 'entropy-desc' | 'entropy-asc' | 'dom-share-desc' | 'dom-share-asc' | 'rows' | 'source'",
    'norm-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        top?: string;
        minNormEntropy?: string;
        maxNormEntropy?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        let minNormEntropy: number | null = null;
        if (opts.minNormEntropy != null) {
          const v = Number.parseFloat(opts.minNormEntropy);
          if (!Number.isFinite(v)) {
            throw new Error(
              `--min-norm-entropy must be a finite number (got ${opts.minNormEntropy})`,
            );
          }
          minNormEntropy = v;
        }
        let maxNormEntropy: number | null = null;
        if (opts.maxNormEntropy != null) {
          const v = Number.parseFloat(opts.maxNormEntropy);
          if (!Number.isFinite(v)) {
            throw new Error(
              `--max-norm-entropy must be a finite number (got ${opts.maxNormEntropy})`,
            );
          }
          maxNormEntropy = v;
        }
        const validSorts = [
          'entropy-asc',
          'entropy-desc',
          'norm-asc',
          'norm-desc',
          'dom-share-desc',
          'dom-share-asc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenSpectralEntropy(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          top,
          minNormEntropy,
          maxNormEntropy,
          sort: opts.sort as
            | 'entropy-asc'
            | 'entropy-desc'
            | 'norm-asc'
            | 'norm-desc'
            | 'dom-share-desc'
            | 'dom-share-asc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenSpectralEntropy(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program

program
  .command('source-row-token-spectral-decrease')
  .description(
    "Per-source Peeters 2004 spectral decrease (1/(k-1)-weighted slope-from-anchor of the one-sided non-DC PSD anchored at bin 1) of the mean-centered per-row total_tokens series. decrease = (1 / sum_{k=2..K} P[k]) * sum_{k=2..K} (P[k] - P[1]) / (k - 1). Sign-bearing perceptually-motivated PSD shape descriptor: < 0 => PSD genuinely decreases away from bin 1; ~ 0 => holds up flat past bin 1; > 0 => mass piles higher up the band. Peeters 2004 (CUIDADO §6.1.2) / Lerch 2012 §3.3.1. Anchored at bin 1 (NOT at the centroid like the central-moment lenses), so genuinely orthogonal to spectral-centroid (location), spectral-bandwidth (2nd central moment around centroid), spectral-skewness/-kurtosis (3rd/4th standardized central moments around centroid), spectral-rolloff (CDF quantile), spectral-flatness (entropy ratio G/A — position-blind, anchor-blind), spectral-entropy (Shannon on normalized PSD — bin-permutation-invariant; decrease depends on bin order), hjorth-mobility, TKEO, single-lag autocorrelation, event counters, time-domain symbolic entropies, scaling/fractal lenses (log-log slope across decades, not linear 1/(k-1)-weighted ratio anchored at bin 1), and all amplitude-domain shape lenses.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n rows; integer >= 4 (default 8)',
    '8',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--min-decrease <v>',
    'suppress sources whose decrease is strictly below this threshold; surfaces them under droppedBelowMinDecrease. Operator-friendly: --min-decrease 0 isolates sources whose PSD does NOT genuinely decrease away from bin 1 (mass holds up flat or rises higher up the band).',
  )
  .option(
    '--max-decrease <v>',
    'suppress sources whose decrease is strictly above this threshold; surfaces them under droppedAboveMaxDecrease. Operator-friendly: --max-decrease 0 isolates sources whose PSD genuinely decreases away from bin 1 (low-frequency-dominant sequences).',
  )
  .option(
    '--sort <key>',
    "sort key: 'decrease-asc' (default; PSD drops most steeply away from bin 1 first) | 'decrease-desc' | 'abs-decrease-desc' | 'rows' | 'source'",
    'decrease-asc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        top?: string;
        minDecrease?: string;
        maxDecrease?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        let minDecrease: number | null = null;
        if (opts.minDecrease != null) {
          const v = Number.parseFloat(opts.minDecrease);
          if (!Number.isFinite(v)) {
            throw new Error(
              `--min-decrease must be a finite number (got ${opts.minDecrease})`,
            );
          }
          minDecrease = v;
        }
        let maxDecrease: number | null = null;
        if (opts.maxDecrease != null) {
          const v = Number.parseFloat(opts.maxDecrease);
          if (!Number.isFinite(v)) {
            throw new Error(
              `--max-decrease must be a finite number (got ${opts.maxDecrease})`,
            );
          }
          maxDecrease = v;
        }
        const validSorts = [
          'decrease-asc',
          'decrease-desc',
          'abs-decrease-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenSpectralDecrease(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          top,
          minDecrease,
          maxDecrease,
          sort: opts.sort as
            | 'decrease-asc'
            | 'decrease-desc'
            | 'abs-decrease-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenSpectralDecrease(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-spectral-irregularity')
  .description(
    "Per-source Jensen 1999 spectral irregularity (bin-difference energy normalized by total bin energy of the one-sided non-DC PSD) of the mean-centered per-row total_tokens series. irregularity = sum_{k=1..K-1} (P[k] - P[k+1])^2 / sum_{k=1..K} P[k]^2. Dimensionless local-jitter PSD descriptor: 0 iff the PSD is perfectly flat across non-DC bins; small => locally smooth bin-to-bin; large => spiky/comb-shaped PSD. Order-sensitive (depends on bin order). Genuinely orthogonal to spectral-centroid (1st moment / location), spectral-bandwidth (2nd central moment around centroid), spectral-skewness/-kurtosis (3rd/4th standardized central moments around centroid — global shape, no local-difference term), spectral-rolloff (CDF quantile — integral, not derivative-like), spectral-flatness (geometric/arithmetic mean ratio — bin-permutation-invariant), spectral-entropy (Shannon — bin-permutation-invariant), spectral-decrease (1/(k-1)-weighted slope-from-anchor at bin 1 — a monotone-smooth-decreasing PSD has strong decrease but low irregularity), and the time-domain / amplitude-domain lenses (which lose the PSD entirely or are order-invariant). Jensen 1999 (DIKU 99/7 §3.5) simplification of Krimphoff/McAdams/Winsberg 1994.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n rows; integer >= 4 (default 8)',
    '8',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'irregularity-desc' (default; jaggedest PSD first) | 'irregularity-asc' | 'rows' | 'source'",
    'irregularity-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'irregularity-desc',
          'irregularity-asc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenSpectralIrregularity(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          top,
          sort: opts.sort as
            | 'irregularity-desc'
            | 'irregularity-asc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenSpectralIrregularity(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-temporal-centroid')
  .description(
    "Per-source Peeters 2004 temporal centroid (amplitude-weighted mean of the time-row index) of the per-row total_tokens series. tc_index = sum_{n=0..N-1} n*a[n] / sum_{n=0..N-1} a[n]; tc = tc_index/(N-1) in [0,1]. tc < 0.5 => front-loaded (early-row energy); tc = 0.5 => balanced; tc > 0.5 => back-loaded (late-row energy). Time-domain dual of spectral-centroid (frequency-domain 1st moment). Order-sensitive on rows; not time-shift invariant. Genuinely orthogonal to all spectral-* lenses (frequency-domain), to fractal/scaling/Hjorth lenses (position-invariant), to time-domain symbolic entropies (which discard amplitude weight), and to amplitude-shape lenses (cv/mad/iqr-ratio/skewness/kurtosis/gini/crest-factor/burstiness — all order-invariant). Peeters, G. (2004), CUIDADO IRCAM Tech. Rep., §6.1.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n rows; integer >= 2 (default 8)',
    '8',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'tc-desc' (default; most back-loaded first) | 'tc-asc' (most front-loaded first) | 'tc-index-desc' | 'tc-index-asc' (raw row-index units rather than normalized fraction) | 'rows' | 'source'",
    'tc-desc',
  )
  .option(
    '--min-tc <x>',
    'inclusive lower bound on tc (in [0,1]); sources with tc < x surface as droppedBelowMinTc',
  )
  .option(
    '--max-tc <x>',
    'inclusive upper bound on tc (in [0,1]); sources with tc > x surface as droppedAboveMaxTc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        top?: string;
        sort: string;
        minTc?: string;
        maxTc?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 2) {
          throw new Error(
            `--min-rows must be an integer >= 2 (got ${opts.minRows})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'tc-desc',
          'tc-asc',
          'tc-index-desc',
          'tc-index-asc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        let minTc: number | null = null;
        if (opts.minTc != null) {
          const x = Number.parseFloat(opts.minTc);
          if (!Number.isFinite(x) || x < 0 || x > 1) {
            throw new Error(`--min-tc must be in [0, 1] (got ${opts.minTc})`);
          }
          minTc = x;
        }
        let maxTc: number | null = null;
        if (opts.maxTc != null) {
          const x = Number.parseFloat(opts.maxTc);
          if (!Number.isFinite(x) || x < 0 || x > 1) {
            throw new Error(`--max-tc must be in [0, 1] (got ${opts.maxTc})`);
          }
          maxTc = x;
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenTemporalCentroid(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          top,
          sort: opts.sort as
            | 'tc-desc'
            | 'tc-asc'
            | 'tc-index-desc'
            | 'tc-index-asc'
            | 'rows'
            | 'source',
          minTc,
          maxTc,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenTemporalCentroid(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-temporal-spread')
  .description(
    "Per-source Peeters 2004 temporal spread (a.k.a. temporal bandwidth): amplitude-weighted standard deviation of the time-row index around the temporal centroid of the per-row total_tokens series. ts_index = sqrt(sum_{n} (n - tc_index)^2 * a[n] / sum a[n]); ts = ts_index/(N-1) in [0, 0.5]. ts -> 0 = impulse-like (all energy at one row); ts ~= 1/sqrt(12) ~ 0.289 = uniform amplitude across rows; ts -> 0.5 = max-bimodal (mass split between row 0 and row N-1). Time-domain dual of spectral-bandwidth (frequency-domain 2nd moment). Order-sensitive on rows; not time-shift invariant. Genuinely orthogonal to temporal-centroid (1st vs 2nd time-domain moment), to all spectral-* lenses (frequency-domain), to fractal/scaling/Hjorth lenses (position-invariant), to time-domain symbolic entropies (which discard amplitude weight), and to amplitude-shape lenses (cv/mad/iqr-ratio/skewness/kurtosis/gini/crest-factor/burstiness — all order-invariant). Peeters, G. (2004), CUIDADO IRCAM Tech. Rep., §6.1.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n rows; integer >= 2 (default 8)',
    '8',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'ts-desc' (default; widest temporal footprint first) | 'ts-asc' (narrowest first) | 'ts-index-desc' | 'ts-index-asc' (raw row-index units rather than normalized fraction) | 'rows' | 'source'",
    'ts-desc',
  )
  .option(
    '--min-ts <x>',
    'inclusive lower bound on ts (in [0, 0.5]); sources with ts < x surface as droppedBelowMinTs',
  )
  .option(
    '--max-ts <x>',
    'inclusive upper bound on ts (in [0, 0.5]); sources with ts > x surface as droppedAboveMaxTs',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        top?: string;
        sort: string;
        minTs?: string;
        maxTs?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 2) {
          throw new Error(
            `--min-rows must be an integer >= 2 (got ${opts.minRows})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'ts-desc',
          'ts-asc',
          'ts-index-desc',
          'ts-index-asc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        let minTs: number | null = null;
        if (opts.minTs != null) {
          const x = Number.parseFloat(opts.minTs);
          if (!Number.isFinite(x) || x < 0 || x > 0.5) {
            throw new Error(`--min-ts must be in [0, 0.5] (got ${opts.minTs})`);
          }
          minTs = x;
        }
        let maxTs: number | null = null;
        if (opts.maxTs != null) {
          const x = Number.parseFloat(opts.maxTs);
          if (!Number.isFinite(x) || x < 0 || x > 0.5) {
            throw new Error(`--max-ts must be in [0, 0.5] (got ${opts.maxTs})`);
          }
          maxTs = x;
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenTemporalSpread(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          top,
          sort: opts.sort as
            | 'ts-desc'
            | 'ts-asc'
            | 'ts-index-desc'
            | 'ts-index-asc'
            | 'rows'
            | 'source',
          minTs,
          maxTs,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenTemporalSpread(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-temporal-skewness')
  .description(
    "Per-source Peeters 2004 temporal skewness: standardized 3rd central moment of the time-row index around the temporal centroid of the per-row total_tokens series. ts3 = (sum_n (n - tc_index)^3 * a[n] / sum a[n]) / ts_index^3 (unitless). ts3 > 0 = early peak with long trailing tail (front-loaded); ts3 < 0 = long quiet build-up with late peak (back-loaded); ts3 ~ 0 = symmetric envelope (uniform / centered). Time-domain dual of spectral-skewness (3rd freq-domain moment). Order-sensitive on rows; not time-shift invariant. Genuinely orthogonal to temporal-centroid (1st vs 3rd time-domain moment), to temporal-spread (sign-blind 2nd moment vs sign-aware 3rd; same tc and ts can yield opposite-sign ts3), to amplitude-shape skewness (order-invariant — permuting rows leaves it unchanged), to all spectral-* lenses (frequency-domain), and to fractal/scaling/Hjorth lenses (position-invariant in time). Peeters, G. (2004), CUIDADO IRCAM Tech. Rep., §6.1.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n rows; integer >= 3 (default 8)',
    '8',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'ts3-desc' (default; most front-loaded first) | 'ts3-asc' (most back-loaded first) | 'abs-ts3-desc' (most asymmetric first) | 'abs-ts3-asc' (most symmetric first) | 'rows' | 'source'",
    'ts3-desc',
  )
  .option(
    '--min-ts3 <x>',
    'inclusive lower bound on ts3 (any finite real); sources with ts3 < x surface as droppedBelowMinTs3',
  )
  .option(
    '--max-ts3 <x>',
    'inclusive upper bound on ts3 (any finite real); sources with ts3 > x surface as droppedAboveMaxTs3',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        top?: string;
        sort: string;
        minTs3?: string;
        maxTs3?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 3) {
          throw new Error(
            `--min-rows must be an integer >= 3 (got ${opts.minRows})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'ts3-desc',
          'ts3-asc',
          'abs-ts3-desc',
          'abs-ts3-asc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        let minTs3: number | null = null;
        if (opts.minTs3 != null) {
          const x = Number.parseFloat(opts.minTs3);
          if (!Number.isFinite(x)) {
            throw new Error(`--min-ts3 must be a finite real (got ${opts.minTs3})`);
          }
          minTs3 = x;
        }
        let maxTs3: number | null = null;
        if (opts.maxTs3 != null) {
          const x = Number.parseFloat(opts.maxTs3);
          if (!Number.isFinite(x)) {
            throw new Error(`--max-ts3 must be a finite real (got ${opts.maxTs3})`);
          }
          maxTs3 = x;
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenTemporalSkewness(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          top,
          sort: opts.sort as
            | 'ts3-desc'
            | 'ts3-asc'
            | 'abs-ts3-desc'
            | 'abs-ts3-asc'
            | 'rows'
            | 'source',
          minTs3,
          maxTs3,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenTemporalSkewness(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-temporal-kurtosis')
  .description(
    "Per-source Peeters 2004 temporal kurtosis: standardized 4th central moment of the time-row index around the temporal centroid of the per-row total_tokens series. ts4 = (sum_n (n - tc_index)^4 * a[n] / sum a[n]) / ts_index^4 (unitless, >= 1). ~1 = symmetric two-point bimodal (mass at the extremes); ~1.8 = uniform envelope; ~3 = Gaussian-like (mesokurtic); >> 3 = sharply peaked / impulsive burst. Time-domain dual of spectral-kurtosis (4th freq-domain moment). Order-sensitive on rows; not time-shift invariant. Genuinely orthogonal to temporal-centroid (1st vs 4th time-domain moment), to temporal-spread (sign-blind 2nd moment vs shape descriptor that divides spread out), to temporal-skewness (sign-aware odd vs sign-blind even moment; mirroring flips ts3 but leaves ts4 unchanged), to amplitude-shape kurtosis (order-invariant — permuting rows leaves it unchanged), to all spectral-* lenses (frequency-domain), and to fractal/scaling/Hjorth lenses (position-invariant in time). Peeters, G. (2004), CUIDADO IRCAM Tech. Rep., §6.1.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n rows; integer >= 4 (default 8)',
    '8',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'ts4-desc' (default; most peaked / impulsive first) | 'ts4-asc' (most flat / bimodal first) | 'dist-uniform-asc' (closest to uniform reference 9/5 first; most envelope-shape-neutral) | 'dist-uniform-desc' (farthest from uniform reference first; most extreme shape — peaked OR bimodal) | 'rows' | 'source'",
    'ts4-desc',
  )
  .option(
    '--min-ts4 <x>',
    'inclusive lower bound on ts4 (finite real >= 1, the Cauchy-Schwarz lower bound for ts4); sources with ts4 < x surface as droppedBelowMinTs4. e.g. --min-ts4 3 isolates the mesokurtic-or-better cohort.',
  )
  .option(
    '--max-ts4 <x>',
    'inclusive upper bound on ts4 (finite real >= 1); sources with ts4 > x surface as droppedAboveMaxTs4. e.g. --max-ts4 1.8 isolates the sub-uniform / bimodal cohort.',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        top?: string;
        sort: string;
        minTs4?: string;
        maxTs4?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = ['ts4-desc', 'ts4-asc', 'dist-uniform-asc', 'dist-uniform-desc', 'rows', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        let minTs4: number | null = null;
        if (opts.minTs4 != null) {
          const x = Number.parseFloat(opts.minTs4);
          if (!Number.isFinite(x)) {
            throw new Error(`--min-ts4 must be a finite real (got ${opts.minTs4})`);
          }
          minTs4 = x;
        }
        let maxTs4: number | null = null;
        if (opts.maxTs4 != null) {
          const x = Number.parseFloat(opts.maxTs4);
          if (!Number.isFinite(x)) {
            throw new Error(`--max-ts4 must be a finite real (got ${opts.maxTs4})`);
          }
          maxTs4 = x;
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenTemporalKurtosis(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          top,
          sort: opts.sort as 'ts4-desc' | 'ts4-asc' | 'dist-uniform-asc' | 'dist-uniform-desc' | 'rows' | 'source',
          minTs4,
          maxTs4,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenTemporalKurtosis(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-temporal-flatness')
  .description(
    "Per-source temporal flatness (Wiener-entropy analog computed directly on the per-row total_tokens amplitude envelope rather than its PSD): tf = G(a) / A(a) where G is the geometric mean and A is the arithmetic mean of a[n] = total_tokens[n]. By AM-GM, 0 < tf <= 1. tf == 1 iff all rows are equal positive (perfectly flat envelope); tf -> 0 iff most rows are near-zero (highly concentrated envelope). Time-domain dual of spectral-flatness (which applies the SAME G/A ratio to the PSD bins). Order-invariant and amplitude-scale-invariant: depends only on the multiset {a[n]}, not on row order or overall magnitude. Genuinely orthogonal to spectral-flatness (different domain — a sine wave has low spectral-flatness but high temporal-flatness; a constant series has high temporal-flatness and undefined spectral-flatness; a single-row impulse has low temporal-flatness and high spectral-flatness), to all temporal moments (centroid/spread/skewness/kurtosis — those are amplitude-weighted moments of the row INDEX; tf is index-blind), to amplitude-shape gini/mad/iqr-ratio/cv/kurtosis/skewness/burstiness/crest-factor (different concentration ratios), to event-counters (zcr/runs/turning/mann-kendall), to symbolic entropies, to fractal/Hjorth lenses. Johnston 1988 (defines AM-GM flatness ratio in spectral domain) / Peeters 2004 (treats amplitude envelope a[n] as time-domain object).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n rows; integer >= 4 (default 8)',
    '8',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'tf-desc' (default; flattest envelope first) | 'tf-asc' (spikiest / most concentrated first) | 'dist-flat-asc' (closest to perfectly-flat reference tf=1 first) | 'dist-flat-desc' (farthest from tf=1 first; most concentrated) | 'rows' | 'source'",
    'tf-desc',
  )
  .option(
    '--min-tf <x>',
    'inclusive lower bound on tf (finite real in (0, 1]); sources with tf < x surface as droppedBelowMinTf. e.g. --min-tf 0.5 isolates the flat-envelope cohort.',
  )
  .option(
    '--max-tf <x>',
    'inclusive upper bound on tf (finite real in (0, 1]); sources with tf > x surface as droppedAboveMaxTf. e.g. --max-tf 0.4 isolates the spiky cohort.',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        top?: string;
        sort: string;
        minTf?: string;
        maxTf?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = ['tf-desc', 'tf-asc', 'dist-flat-asc', 'dist-flat-desc', 'rows', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        let minTf: number | null = null;
        if (opts.minTf != null) {
          const x = Number.parseFloat(opts.minTf);
          if (!Number.isFinite(x)) {
            throw new Error(`--min-tf must be a finite real (got ${opts.minTf})`);
          }
          minTf = x;
        }
        let maxTf: number | null = null;
        if (opts.maxTf != null) {
          const x = Number.parseFloat(opts.maxTf);
          if (!Number.isFinite(x)) {
            throw new Error(`--max-tf must be a finite real (got ${opts.maxTf})`);
          }
          maxTf = x;
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenTemporalFlatness(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          top,
          sort: opts.sort as 'tf-desc' | 'tf-asc' | 'dist-flat-asc' | 'dist-flat-desc' | 'rows' | 'source',
          minTf,
          maxTf,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenTemporalFlatness(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-temporal-entropy')
  .description(
    "Per-source temporal Shannon entropy (computed directly on the per-row total_tokens amplitude envelope rather than on a PSD or symbolic alphabet): normalize a[n] = total_tokens[n] into p[n] = a[n] / sum(a), then H(p) = -sum p ln p in nats, with H_norm = H / ln(N) reported as the headline value in [0, 1]. H_norm == 1 iff the envelope is uniform across all rows (mass spread perfectly evenly); H_norm == 0 iff a single row carries all token mass. Time-domain dual of spectral-entropy (which applies the SAME Shannon formula to PSD bins). Order-invariant and amplitude-scale invariant: depends only on the multiset {p[n]}, not on row order or overall magnitude. Genuinely orthogonal to spectral-entropy (different domain — sine wave has low spectral entropy and high temporal entropy; constant series has high temporal entropy and undefined spectral entropy; single-row impulse has low temporal entropy and high spectral entropy), to temporal-flatness (G/A ratio is multiplicative concentration; Shannon H is information-theoretic spread — they agree at extremes but diverge in the middle), to all temporal moments (centroid/spread/skewness/kurtosis weight by row INDEX; H is index-blind), to amplitude-shape gini/mad/iqr-ratio/cv/kurtosis/skewness/burstiness/crest-factor (different concentration ratios), to symbolic entropies (approximate/sample/permutation/renyi/lempel-ziv operate on a symbolic coarse-graining; H here is on the raw amplitude mass), to event-counters (zcr/runs/turning/mann-kendall), and to fractal/Hjorth lenses. Shannon 1948 / Peeters 2004.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n rows; integer >= 4 (default 8)',
    '8',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'norm-entropy-desc' (default; most-uniform / most-spread mass first) | 'norm-entropy-asc' (most-concentrated mass first) | 'dist-uniform-asc' (closest to uniform reference H_norm=1 first) | 'dist-uniform-desc' (farthest from uniform first; most concentrated) | 'rows' | 'source'",
    'norm-entropy-desc',
  )
  .option(
    '--min-norm-entropy <x>',
    'inclusive lower bound on normEntropy (finite real in [0, 1]); sources with normEntropy < x surface as droppedBelowMinNormEntropy. e.g. --min-norm-entropy 0.7 isolates the spread-mass cohort.',
  )
  .option(
    '--max-norm-entropy <x>',
    'inclusive upper bound on normEntropy (finite real in [0, 1]); sources with normEntropy > x surface as droppedAboveMaxNormEntropy. e.g. --max-norm-entropy 0.4 isolates the concentrated cohort.',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        top?: string;
        sort: string;
        minNormEntropy?: string;
        maxNormEntropy?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'norm-entropy-desc',
          'norm-entropy-asc',
          'dist-uniform-asc',
          'dist-uniform-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        let minNormEntropy: number | null = null;
        if (opts.minNormEntropy != null) {
          const x = Number.parseFloat(opts.minNormEntropy);
          if (!Number.isFinite(x)) {
            throw new Error(
              `--min-norm-entropy must be a finite real (got ${opts.minNormEntropy})`,
            );
          }
          minNormEntropy = x;
        }
        let maxNormEntropy: number | null = null;
        if (opts.maxNormEntropy != null) {
          const x = Number.parseFloat(opts.maxNormEntropy);
          if (!Number.isFinite(x)) {
            throw new Error(
              `--max-norm-entropy must be a finite real (got ${opts.maxNormEntropy})`,
            );
          }
          maxNormEntropy = x;
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenTemporalEntropy(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          top,
          sort: opts.sort as
            | 'norm-entropy-desc'
            | 'norm-entropy-asc'
            | 'dist-uniform-asc'
            | 'dist-uniform-desc'
            | 'rows'
            | 'source',
          minNormEntropy,
          maxNormEntropy,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenTemporalEntropy(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-trimean')
  .description(
    "Per-source Tukey trimean TM = (q1 + 2*median + q3) / 4 of per-row total_tokens (type-7 quantiles). Robust central-tendency L-estimator with 25%-breakdown — sits between the mean (0%-breakdown, dominated by single huge rows) and the median (50%-breakdown, ignores both tails). Translation- and scale-equivariant; equals the median for any symmetric distribution and shifts towards the longer tail otherwise. Distinct from every existing source-row-token-* lens because no current lens reports a robust central-tendency scalar in the same units as total_tokens: source-row-token-mad reports a SPREAD (median of absolute deviations); source-row-token-coefficient-of-quartile-deviation, source-row-token-bowley-skewness, source-row-token-iqr-ratio all use the same three quantiles to measure SHAPE (dispersion / direction / spread-vs-center ratio); source-row-token-coefficient-of-variation, source-row-token-burstiness-coefficient, source-row-token-skewness, source-row-token-kurtosis are MOMENT-based shape statistics, not location; source-output-tokens-per-row-percentiles exposes the raw P50/P75/P90/P99 of output_tokens (different field, no L-estimator blend). Trimean and the (implicit) mean disagree on any non-symmetric distribution; trimean and the median agree on symmetric distributions but trimean shifts towards the longer tail by exactly half the gap between midhinge and median. tmMedianGap = trimean - median is reported as a free robust skew direction signal (positive = upper central half heavier; bounded by [-(q3-q1)/4, +(q3-q1)/4]).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; must be an integer >= 4 (need at least one observation per quartile slot for meaningful Q1/Q3) (default 4)',
    '4',
  )
  .option(
    '--min-trimean <f>',
    'drop sources whose trimean is strictly below f; cohort selector for "this source actually carries non-trivial central token magnitude" — useful to hide low-volume noise sources before ranking. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'trimean-desc' (default) | 'trimean-asc' | 'median-desc' | 'gap-desc' (|tmMedianGap| desc — most asymmetric central halves first) | 'rows' | 'source'",
    'trimean-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minTrimean: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        const minTrimean = Number.parseFloat(opts.minTrimean);
        if (!Number.isFinite(minTrimean) || minTrimean < 0) {
          throw new Error(
            `--min-trimean must be a finite, non-negative number (got ${opts.minTrimean})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'trimean-desc',
          'trimean-asc',
          'median-desc',
          'gap-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenTrimean(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minTrimean,
          top,
          sort: opts.sort as
            | 'trimean-desc'
            | 'trimean-asc'
            | 'median-desc'
            | 'gap-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRowTokenTrimean(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-midhinge')
  .description(
    "Per-source Tukey midhinge MH = (q1 + q3) / 2 of per-row total_tokens (type-7 quantiles). Pure-IQR central-tendency L-estimator with 25%-breakdown — drops the median entirely (the trimean weights median 1/2; midhinge weights it 0). Translation- and scale-equivariant; equals the median only when the central half is symmetric. Distinct from every existing source-row-token-* lens: source-row-token-trimean = MH/2 + median/2 (blends midhinge with median 50/50, so trimean and midhinge disagree by exactly (median - midhinge)/2 on any asymmetric central half); source-row-token-mad reports a SPREAD (median of absolute deviations); source-row-token-coefficient-of-quartile-deviation, source-row-token-bowley-skewness, source-row-token-iqr-ratio all use the same q1/q3 to measure SHAPE (dispersion / direction / spread-vs-center ratio); source-row-token-coefficient-of-variation, source-row-token-burstiness-coefficient, source-row-token-skewness, source-row-token-kurtosis are MOMENT-based shape statistics, not location; source-output-tokens-per-row-percentiles exposes the raw P50/P75/P90/P99 of output_tokens (different field, no L-estimator blend). Two distributions sharing q1 and q3 but with very different medians have identical midhinges. mhMedianGap = midhinge - median is reported as a free signal for where the median sits inside its own IQR (positive = median in lower half of [q1, q3], i.e. upper central half longer; bounded by [-(q3-q1)/2, +(q3-q1)/2]).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; must be an integer >= 4 (need at least one observation per quartile slot for meaningful Q1/Q3) (default 4)',
    '4',
  )
  .option(
    '--min-midhinge <f>',
    'drop sources whose midhinge is strictly below f; cohort selector for "this source actually carries non-trivial central token magnitude" — useful to hide low-volume noise sources before ranking. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'midhinge-desc' (default) | 'midhinge-asc' | 'median-desc' | 'gap-desc' (|mhMedianGap| desc — median furthest from IQR center first) | 'rows' | 'source'",
    'midhinge-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minMidhinge: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        const minMidhinge = Number.parseFloat(opts.minMidhinge);
        if (!Number.isFinite(minMidhinge) || minMidhinge < 0) {
          throw new Error(
            `--min-midhinge must be a finite, non-negative number (got ${opts.minMidhinge})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'midhinge-desc',
          'midhinge-asc',
          'median-desc',
          'gap-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenMidhinge(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minMidhinge,
          top,
          sort: opts.sort as
            | 'midhinge-desc'
            | 'midhinge-asc'
            | 'median-desc'
            | 'gap-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRowTokenMidhinge(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-mid-range')
  .description(
    "Per-source mid-range MR = (min + max) / 2 of per-row total_tokens. Extreme L-estimator with 0%-breakdown — uses ONLY the two tail order statistics, the perfect robustness complement to the midhinge (25%-breakdown, IQR-only) and the median (50%-breakdown, central). Translation- and scale-equivariant; equals the median only when the median sits exactly at the midpoint of [min, max]. Distinct from every existing source-row-token-* lens: source-row-token-midhinge = (q1+q3)/2 ignores the bottom 25% and top 25% entirely, mid-range listens to ONLY the bottom 1/n and top 1/n; source-row-token-trimean = (q1+2*median+q3)/4 blends three central quantiles, mid-range uses zero central quantiles; source-row-token-mad reports a SPREAD; source-row-token-coefficient-of-quartile-deviation, source-row-token-bowley-skewness, source-row-token-iqr-ratio measure SHAPE from q1/q3; source-row-token-coefficient-of-variation, source-row-token-burstiness-coefficient, source-row-token-skewness, source-row-token-kurtosis are MOMENT-based shape statistics; source-output-tokens-per-row-percentiles exposes raw P50/P75/P90/P99 of output_tokens (different field, never reports absolute min or max). Two distributions sharing min and max but with arbitrarily different inner shapes have identical mid-ranges. mrMedianGap = mid_range - median is reported as a free signal for where the median sits inside the full range (positive = median in lower half of [min, max], i.e. upper tail longer; bounded by [-(max-min)/2, +(max-min)/2]). Free byproduct range = max - min is also reported.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; must be an integer >= 2 (need at least one min and one max for a meaningful range midpoint) (default 2)',
    '2',
  )
  .option(
    '--min-mid-range <f>',
    'drop sources whose mid-range is strictly below f; cohort selector for "this source actually carries non-trivial range-center token magnitude" — useful to hide low-volume noise sources before ranking. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'mid-range-desc' (default) | 'mid-range-asc' | 'median-desc' | 'gap-desc' (|mrMedianGap| desc — median furthest from range center first) | 'range-desc' (widest support first) | 'rows' | 'source'",
    'mid-range-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minMidRange: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 2) {
          throw new Error(
            `--min-rows must be an integer >= 2 (got ${opts.minRows})`,
          );
        }
        const minMidRange = Number.parseFloat(opts.minMidRange);
        if (!Number.isFinite(minMidRange) || minMidRange < 0) {
          throw new Error(
            `--min-mid-range must be a finite, non-negative number (got ${opts.minMidRange})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'mid-range-desc',
          'mid-range-asc',
          'median-desc',
          'gap-desc',
          'range-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenMidRange(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minMidRange,
          top,
          sort: opts.sort as
            | 'mid-range-desc'
            | 'mid-range-asc'
            | 'median-desc'
            | 'gap-desc'
            | 'range-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRowTokenMidRange(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-trim-mean-25')
  .description(
    "Per-source 25 % symmetrically trimmed mean of per-row total_tokens. Sort the rows, drop the bottom k = floor(0.25 n) and top k order statistics, then take the arithmetic mean of the central n - 2k. Symmetric L-estimator with 25 % breakdown — strictly more robust than the mean and the mid-range (both 0 %), strictly less than the median (50 %). Translation- and scale-equivariant. Distinct from every existing source-row-token-* lens: source-row-token-mid-range = (min+max)/2 listens to ONLY the two tails (0 % breakdown); trim-mean-25 DISCARDS both tails (25 % breakdown). source-row-token-midhinge = (q1+q3)/2 weights ZERO central rows; trim-mean-25 weights ALL central rows equally. source-row-token-trimean = (q1+2*median+q3)/4 weights three specific quantiles; trim-mean-25 averages the entire interquartile body, so it is sensitive to the SHAPE of the central 50 %. source-row-token-mad reports a SPREAD; source-row-token-coefficient-of-quartile-deviation, source-row-token-bowley-skewness, source-row-token-iqr-ratio measure SHAPE from q1/q3; source-row-token-coefficient-of-variation, source-row-token-burstiness-coefficient, source-row-token-skewness, source-row-token-kurtosis, source-row-token-gini are MOMENT- or distribution-shape statistics; source-output-tokens-per-row-percentiles exposes raw P50/P75/P90/P99 of output_tokens (different field). tmMeanGap = trim_mean - mean is reported as a free signal: negative means the raw mean is being pulled UP by an upper tail that the trimmed mean filters out (the standard 'single huge token row' signal); positive means a lower tail is dragging the raw mean down. Free byproduct mean (arithmetic mean of all kept rows) is also reported as the natural reference and the obvious sanity check.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n kept rows; must be an integer >= 4 (need k = floor(0.25 n) >= 1 to actually trim — at n < 4, k = 0 and the trimmed mean degenerates to the arithmetic mean) (default 4)',
    '4',
  )
  .option(
    '--min-trim-mean <f>',
    'drop sources whose trim-mean is strictly below f; cohort selector for "this source actually carries non-trivial body-location token magnitude" — useful to hide low-volume noise sources before ranking. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'trim-mean-desc' (default) | 'trim-mean-asc' | 'mean-desc' | 'gap-desc' (|tmMeanGap| desc — mean furthest from body first) | 'rows' | 'source'",
    'trim-mean-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minTrimMean: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 4) {
          throw new Error(
            `--min-rows must be an integer >= 4 (got ${opts.minRows})`,
          );
        }
        const minTrimMean = Number.parseFloat(opts.minTrimMean);
        if (!Number.isFinite(minTrimMean) || minTrimMean < 0) {
          throw new Error(
            `--min-trim-mean must be a finite, non-negative number (got ${opts.minTrimMean})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'trim-mean-desc',
          'trim-mean-asc',
          'mean-desc',
          'gap-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenTrimMean25(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minTrimMean,
          top,
          sort: opts.sort as
            | 'trim-mean-desc'
            | 'trim-mean-asc'
            | 'mean-desc'
            | 'gap-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRowTokenTrimMean25(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-harmonic-mean')
  .description(
    "Per-source harmonic mean of per-row total_tokens. HM = n / sum(1/x_i). The Pythagorean lower bound — by AM-GM-HM, HM <= GM <= AM with equality iff the series is constant. Scale-equivariant but NOT translation-equivariant — the qualitative break from every existing source-row-token-* location lens (mean, median, midhinge, trimean, mid-range, trim-mean-25 are all translation-equivariant; HM is not). Dominated by the SMALLEST rows: a single tiny row pulls HM toward zero hard, the opposite of the arithmetic mean which is dominated by the LARGEST rows. Distinct from every existing lens: source-row-token-mid-range / midhinge / trimean / trim-mean-25 are L-estimators (linear combinations of order statistics), translation- AND scale-equivariant; HM is non-linear in every row's value. source-row-token-mad reports a SPREAD; source-row-token-coefficient-of-quartile-deviation, source-row-token-bowley-skewness, source-row-token-iqr-ratio measure SHAPE from q1/q3; source-row-token-coefficient-of-variation, source-row-token-burstiness-coefficient, source-row-token-skewness, source-row-token-kurtosis, source-row-token-gini are MOMENT- or distribution-shape statistics; source-output-tokens-per-row-percentiles exposes raw P50/P75/P90/P99 of output_tokens (different field). hmAmGap = HM - mean is reported as a free signal: ALWAYS <= 0 by AM-GM-HM, with magnitude growing as the multiplicative spread of the series grows. Free byproduct mean (arithmetic mean of all kept rows) is also reported as the natural reference and the AM-GM-HM upper bound on HM.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n strictly positive kept rows; must be an integer >= 1 (HM is well-defined for any single strictly positive row) (default 1)',
    '1',
  )
  .option(
    '--min-harmonic-mean <f>',
    'drop sources whose harmonic mean is strictly below f; cohort selector for "this source actually carries non-trivial small-row-weighted token magnitude". f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'harmonic-mean-desc' (default) | 'harmonic-mean-asc' | 'mean-desc' | 'gap-desc' (|hmAmGap| desc — multiplicative spread first) | 'rows' | 'source'",
    'harmonic-mean-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minHarmonicMean: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 1) {
          throw new Error(
            `--min-rows must be an integer >= 1 (got ${opts.minRows})`,
          );
        }
        const minHarmonicMean = Number.parseFloat(opts.minHarmonicMean);
        if (!Number.isFinite(minHarmonicMean) || minHarmonicMean < 0) {
          throw new Error(
            `--min-harmonic-mean must be a finite, non-negative number (got ${opts.minHarmonicMean})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'harmonic-mean-desc',
          'harmonic-mean-asc',
          'mean-desc',
          'gap-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenHarmonicMean(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minHarmonicMean,
          top,
          sort: opts.sort as
            | 'harmonic-mean-desc'
            | 'harmonic-mean-asc'
            | 'mean-desc'
            | 'gap-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRowTokenHarmonicMean(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-quadratic-mean')
  .description(
    "Per-source quadratic mean (RMS) of per-row total_tokens. QM = sqrt(mean(x^2)). The Pythagorean UPPER bound — by QM-AM, AM <= QM with equality iff the series is constant. Together with v0.6.186's source-row-token-harmonic-mean (HM, GM, AM) completes the full Pythagorean sandwich HM <= GM <= AM <= QM. Scale-equivariant but NOT translation-equivariant — same break from L-estimator suite as harmonic-mean but in the OPPOSITE direction (HM moves less than c on shift; QM moves more than c on shift). Dominated by the LARGEST rows even more aggressively than the arithmetic mean: squaring amplifies large-row contribution by an extra factor of ~sqrt(n) for the bottleneck row. Distinct from every existing lens: source-row-token-mid-range / midhinge / trimean / trim-mean-25 are L-estimators (linear combinations of order statistics), translation- AND scale-equivariant; QM is non-linear in every row's value. source-row-token-mad reports a SPREAD; source-row-token-coefficient-of-quartile-deviation, source-row-token-bowley-skewness, source-row-token-iqr-ratio measure SHAPE from q1/q3; source-row-token-coefficient-of-variation, source-row-token-burstiness-coefficient, source-row-token-skewness, source-row-token-kurtosis, source-row-token-gini are MOMENT- or distribution-shape statistics. Distinct from source-row-token-crest-factor: crest-factor is the dimensionless ratio max/RMS that USES RMS as a denominator; QM is the RMS itself in token units as a standalone location signal. qmAmGap = QM - mean is reported as a free signal: ALWAYS >= 0 by QM-AM, with magnitude growing as the multiplicative spread of the series grows.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n non-negative kept rows; must be an integer >= 1 (QM is well-defined for any single non-negative row) (default 1)',
    '1',
  )
  .option(
    '--min-quadratic-mean <f>',
    'drop sources whose quadratic mean is strictly below f; cohort selector for "this source actually carries non-trivial squared-weighted token magnitude". f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'quadratic-mean-desc' (default) | 'quadratic-mean-asc' | 'mean-desc' | 'gap-desc' (qmAmGap desc — multiplicative spread first) | 'rows' | 'source'",
    'quadratic-mean-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minQuadraticMean: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 1) {
          throw new Error(
            `--min-rows must be an integer >= 1 (got ${opts.minRows})`,
          );
        }
        const minQuadraticMean = Number.parseFloat(opts.minQuadraticMean);
        if (!Number.isFinite(minQuadraticMean) || minQuadraticMean < 0) {
          throw new Error(
            `--min-quadratic-mean must be a finite, non-negative number (got ${opts.minQuadraticMean})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'quadratic-mean-desc',
          'quadratic-mean-asc',
          'mean-desc',
          'gap-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenQuadraticMean(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minQuadraticMean,
          top,
          sort: opts.sort as
            | 'quadratic-mean-desc'
            | 'quadratic-mean-asc'
            | 'mean-desc'
            | 'gap-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRowTokenQuadraticMean(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-contraharmonic-mean')
  .description(
    "Per-source contraharmonic mean (Lehmer L_2) of per-row total_tokens. CHM = sum(x^2) / sum(x). Extends v0.6.187's Pythagorean sandwich one step further to the right: HM <= GM <= AM <= QM <= CHM (Cauchy-Schwarz). Equivalently, the x-self-weighted arithmetic mean — each row weights itself by its own value. Scale-equivariant, NOT translation-equivariant. Dominated by the LARGEST rows even more aggressively than QM: a single bottleneck row pushes CHM toward that row's value, while QM only goes as M/sqrt(n). Distinct from every existing lens: source-row-token-mid-range / midhinge / trimean / trim-mean-25 are L-estimators (translation- AND scale-equivariant); source-row-token-mad reports a SPREAD; source-row-token-coefficient-of-quartile-deviation, source-row-token-bowley-skewness, source-row-token-iqr-ratio measure SHAPE; source-row-token-coefficient-of-variation, source-row-token-burstiness-coefficient, source-row-token-skewness, source-row-token-kurtosis, source-row-token-gini are MOMENT- or distribution-shape statistics. Distinct from source-row-token-crest-factor: crest-factor is a dimensionless ratio max/RMS; CHM is the size-weighted location itself in token units. chmAmGap = CHM - mean and chmQmGap = CHM - QM are reported as free signals: ALWAYS >= 0 by Cauchy-Schwarz, with magnitude growing as the multiplicative spread of the positive part of the series grows.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n non-negative kept rows; must be an integer >= 1 (default 1)',
    '1',
  )
  .option(
    '--min-contraharmonic-mean <f>',
    'drop sources whose contraharmonic mean is strictly below f; cohort selector. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'contraharmonic-mean-desc' (default) | 'contraharmonic-mean-asc' | 'mean-desc' | 'gap-desc' (chmAmGap desc) | 'qm-gap-desc' (chmQmGap desc) | 'rows' | 'source'",
    'contraharmonic-mean-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minContraharmonicMean: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 1) {
          throw new Error(
            `--min-rows must be an integer >= 1 (got ${opts.minRows})`,
          );
        }
        const minContraharmonicMean = Number.parseFloat(
          opts.minContraharmonicMean,
        );
        if (
          !Number.isFinite(minContraharmonicMean) ||
          minContraharmonicMean < 0
        ) {
          throw new Error(
            `--min-contraharmonic-mean must be a finite, non-negative number (got ${opts.minContraharmonicMean})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'contraharmonic-mean-desc',
          'contraharmonic-mean-asc',
          'mean-desc',
          'gap-desc',
          'qm-gap-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenContraharmonicMean(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minContraharmonicMean,
          top,
          sort: opts.sort as
            | 'contraharmonic-mean-desc'
            | 'contraharmonic-mean-asc'
            | 'mean-desc'
            | 'gap-desc'
            | 'qm-gap-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenContraharmonicMean(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-lehmer-3-mean')
  .description(
    "Per-source Lehmer mean of order 3 (L_3) of per-row total_tokens. L_3 = sum(x^3) / sum(x^2). Extends v0.6.188's Pythagorean+CHM sandwich one step further to the right: HM <= GM <= AM <= QM <= CHM <= L_3 (Lehmer monotonicity). Equivalently, the x^2-self-weighted arithmetic mean — each row weights itself by its own SQUARE. Scale-equivariant, NOT translation-equivariant. Dominated by the LARGEST rows even more aggressively than CHM: a single bottleneck row pushes L_3 toward that row's value faster than CHM does. Distinct from every existing lens: L-estimators (mid-range / midhinge / trimean / trim-mean-25) are translation- AND scale-equivariant; mad reports a SPREAD; coefficient-of-quartile-deviation / bowley-skewness / iqr-ratio measure SHAPE; coefficient-of-variation / burstiness-coefficient / skewness / kurtosis / gini are MOMENT- or distribution-shape statistics; crest-factor is a dimensionless ratio; contraharmonic-mean (L_2) weights by x, this lens (L_3) weights by x^2. l3ChmGap = L_3 - CHM and l3AmGap = L_3 - mean are reported as free signals: ALWAYS >= 0, with magnitude growing as the multiplicative spread of the positive part of the series grows.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n non-negative kept rows; must be an integer >= 1 (default 1)',
    '1',
  )
  .option(
    '--min-lehmer-3-mean <f>',
    'drop sources whose Lehmer-3 mean is strictly below f; cohort selector. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'lehmer-3-mean-desc' (default) | 'lehmer-3-mean-asc' | 'mean-desc' | 'chm-gap-desc' (l3ChmGap desc) | 'am-gap-desc' (l3AmGap desc) | 'rows' | 'source'",
    'lehmer-3-mean-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minLehmer3Mean: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 1) {
          throw new Error(
            `--min-rows must be an integer >= 1 (got ${opts.minRows})`,
          );
        }
        const minLehmer3Mean = Number.parseFloat(opts.minLehmer3Mean);
        if (!Number.isFinite(minLehmer3Mean) || minLehmer3Mean < 0) {
          throw new Error(
            `--min-lehmer-3-mean must be a finite, non-negative number (got ${opts.minLehmer3Mean})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'lehmer-3-mean-desc',
          'lehmer-3-mean-asc',
          'mean-desc',
          'chm-gap-desc',
          'am-gap-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenLehmer3Mean(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minLehmer3Mean,
          top,
          sort: opts.sort as
            | 'lehmer-3-mean-desc'
            | 'lehmer-3-mean-asc'
            | 'mean-desc'
            | 'chm-gap-desc'
            | 'am-gap-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenLehmer3Mean(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-lehmer-4-mean')
  .description(
    "Per-source Lehmer mean of order 4 (L_4) of per-row total_tokens. L_4 = sum(x^4) / sum(x^3). Extends v0.6.188's Lehmer ladder one step further to the right of L_3: HM <= GM <= AM <= QM <= CHM <= L_3 <= L_4 (Lehmer monotonicity). Equivalently, the x^3-self-weighted arithmetic mean — each row weights itself by its own CUBE. Scale-equivariant, NOT translation-equivariant. Dominated by the LARGEST rows even more aggressively than L_3: a single bottleneck row pushes L_4 toward that row's value faster than L_3 does. Distinct from every existing lens: L-estimators (mid-range / midhinge / trimean / trim-mean-25) are translation- AND scale-equivariant; mad reports a SPREAD; coefficient-of-quartile-deviation / bowley-skewness / iqr-ratio measure SHAPE; coefficient-of-variation / burstiness-coefficient / skewness / kurtosis / gini are MOMENT- or distribution-shape statistics; crest-factor is a dimensionless ratio; lehmer-3-mean (L_3) weights by x^2, this lens (L_4) weights by x^3. l4L3Gap = L_4 - L_3, l4ChmGap = L_4 - CHM, l4AmGap = L_4 - mean are reported as free signals: ALL >= 0, with magnitude growing as the multiplicative spread of the positive part of the series grows.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n non-negative kept rows; must be an integer >= 1 (default 1)',
    '1',
  )
  .option(
    '--min-lehmer-4-mean <f>',
    'drop sources whose Lehmer-4 mean is strictly below f; cohort selector. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'lehmer-4-mean-desc' (default) | 'lehmer-4-mean-asc' | 'mean-desc' | 'l3-gap-desc' (l4L3Gap desc) | 'chm-gap-desc' (l4ChmGap desc) | 'am-gap-desc' (l4AmGap desc) | 'rows' | 'source'",
    'lehmer-4-mean-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minLehmer4Mean: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 1) {
          throw new Error(
            `--min-rows must be an integer >= 1 (got ${opts.minRows})`,
          );
        }
        const minLehmer4Mean = Number.parseFloat(opts.minLehmer4Mean);
        if (!Number.isFinite(minLehmer4Mean) || minLehmer4Mean < 0) {
          throw new Error(
            `--min-lehmer-4-mean must be a finite, non-negative number (got ${opts.minLehmer4Mean})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'lehmer-4-mean-desc',
          'lehmer-4-mean-asc',
          'mean-desc',
          'l3-gap-desc',
          'chm-gap-desc',
          'am-gap-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenLehmer4Mean(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minLehmer4Mean,
          top,
          sort: opts.sort as
            | 'lehmer-4-mean-desc'
            | 'lehmer-4-mean-asc'
            | 'mean-desc'
            | 'l3-gap-desc'
            | 'chm-gap-desc'
            | 'am-gap-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenLehmer4Mean(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-lehmer-5-mean')
  .description(
    "Per-source Lehmer mean of order 5 (L_5) of per-row total_tokens. L_5 = sum(x^5) / sum(x^4). Extends v0.6.193's Lehmer ladder one step further to the right of L_4: HM <= GM <= AM <= QM <= CHM <= L_3 <= L_4 <= L_5 (Lehmer monotonicity). Equivalently, the x^4-self-weighted arithmetic mean — each row weights itself by its own FOURTH POWER. Scale-equivariant, NOT translation-equivariant. Dominated by the LARGEST rows even more aggressively than L_4. l5L4Gap = L_5 - L_4, l5L3Gap = L_5 - L_3, l5AmGap = L_5 - mean are reported as free signals: ALL >= 0.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n non-negative kept rows; must be an integer >= 1 (default 1)',
    '1',
  )
  .option(
    '--min-lehmer-5-mean <f>',
    'drop sources whose Lehmer-5 mean is strictly below f; cohort selector. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'lehmer-5-mean-desc' (default) | 'lehmer-5-mean-asc' | 'mean-desc' | 'l4-gap-desc' (l5L4Gap desc) | 'l3-gap-desc' (l5L3Gap desc) | 'am-gap-desc' (l5AmGap desc) | 'rows' | 'source'",
    'lehmer-5-mean-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minLehmer5Mean: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 1) {
          throw new Error(
            `--min-rows must be an integer >= 1 (got ${opts.minRows})`,
          );
        }
        const minLehmer5Mean = Number.parseFloat(opts.minLehmer5Mean);
        if (!Number.isFinite(minLehmer5Mean) || minLehmer5Mean < 0) {
          throw new Error(
            `--min-lehmer-5-mean must be a finite, non-negative number (got ${opts.minLehmer5Mean})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'lehmer-5-mean-desc',
          'lehmer-5-mean-asc',
          'mean-desc',
          'l4-gap-desc',
          'l3-gap-desc',
          'am-gap-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenLehmer5Mean(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minLehmer5Mean,
          top,
          sort: opts.sort as
            | 'lehmer-5-mean-desc'
            | 'lehmer-5-mean-asc'
            | 'mean-desc'
            | 'l4-gap-desc'
            | 'l3-gap-desc'
            | 'am-gap-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenLehmer5Mean(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-lehmer-6-mean')
  .description(
    "Per-source Lehmer mean of order 6 (L_6) of per-row total_tokens. L_6 = sum(x^6) / sum(x^5). Extends v0.6.194's Lehmer ladder one step further to the right of L_5: HM <= GM <= AM <= QM <= CHM <= L_3 <= L_4 <= L_5 <= L_6 (Lehmer monotonicity). Equivalently, the x^5-self-weighted arithmetic mean — each row weights itself by its own FIFTH POWER. Scale-equivariant, NOT translation-equivariant. Dominated by the LARGEST rows even more aggressively than L_5. l6L5Gap = L_6 - L_5, l6L4Gap = L_6 - L_4, l6AmGap = L_6 - mean are reported as free signals: ALL >= 0.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n non-negative kept rows; must be an integer >= 1 (default 1)',
    '1',
  )
  .option(
    '--min-lehmer-6-mean <f>',
    'drop sources whose Lehmer-6 mean is strictly below f; cohort selector. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'lehmer-6-mean-desc' (default) | 'lehmer-6-mean-asc' | 'mean-desc' | 'l5-gap-desc' (l6L5Gap desc) | 'l4-gap-desc' (l6L4Gap desc) | 'am-gap-desc' (l6AmGap desc) | 'rows' | 'source'",
    'lehmer-6-mean-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minLehmer6Mean: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 1) {
          throw new Error(
            `--min-rows must be an integer >= 1 (got ${opts.minRows})`,
          );
        }
        const minLehmer6Mean = Number.parseFloat(opts.minLehmer6Mean);
        if (!Number.isFinite(minLehmer6Mean) || minLehmer6Mean < 0) {
          throw new Error(
            `--min-lehmer-6-mean must be a finite, non-negative number (got ${opts.minLehmer6Mean})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'lehmer-6-mean-desc',
          'lehmer-6-mean-asc',
          'mean-desc',
          'l5-gap-desc',
          'l4-gap-desc',
          'am-gap-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenLehmer6Mean(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minLehmer6Mean,
          top,
          sort: opts.sort as
            | 'lehmer-6-mean-desc'
            | 'lehmer-6-mean-asc'
            | 'mean-desc'
            | 'l5-gap-desc'
            | 'l4-gap-desc'
            | 'am-gap-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenLehmer6Mean(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-lehmer-7-mean')
  .description(
    "Per-source Lehmer mean of order 7 (L_7) of per-row total_tokens. L_7 = sum(x^7) / sum(x^6). Extends v0.6.195's Lehmer ladder one step further to the right of L_6: HM <= GM <= AM <= QM <= CHM <= L_3 <= L_4 <= L_5 <= L_6 <= L_7 (Lehmer monotonicity). Equivalently, the x^6-self-weighted arithmetic mean — each row weights itself by its own SIXTH POWER. Scale-equivariant, NOT translation-equivariant. Dominated by the LARGEST rows even more aggressively than L_6. l7L6Gap = L_7 - L_6, l7L5Gap = L_7 - L_5, l7AmGap = L_7 - mean are reported as free signals: ALL >= 0.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n non-negative kept rows; must be an integer >= 1 (default 1)',
    '1',
  )
  .option(
    '--min-lehmer-7-mean <f>',
    'drop sources whose Lehmer-7 mean is strictly below f; cohort selector. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'lehmer-7-mean-desc' (default) | 'lehmer-7-mean-asc' | 'mean-desc' | 'l6-gap-desc' (l7L6Gap desc) | 'l5-gap-desc' (l7L5Gap desc) | 'am-gap-desc' (l7AmGap desc) | 'rows' | 'source'",
    'lehmer-7-mean-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minLehmer7Mean: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 1) {
          throw new Error(
            `--min-rows must be an integer >= 1 (got ${opts.minRows})`,
          );
        }
        const minLehmer7Mean = Number.parseFloat(opts.minLehmer7Mean);
        if (!Number.isFinite(minLehmer7Mean) || minLehmer7Mean < 0) {
          throw new Error(
            `--min-lehmer-7-mean must be a finite, non-negative number (got ${opts.minLehmer7Mean})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const validSorts = [
          'lehmer-7-mean-desc',
          'lehmer-7-mean-asc',
          'mean-desc',
          'l6-gap-desc',
          'l5-gap-desc',
          'am-gap-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenLehmer7Mean(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minLehmer7Mean,
          top,
          sort: opts.sort as
            | 'lehmer-7-mean-desc'
            | 'lehmer-7-mean-asc'
            | 'mean-desc'
            | 'l6-gap-desc'
            | 'l5-gap-desc'
            | 'am-gap-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenLehmer7Mean(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-lehmer-neg-1-mean')
  .description(
    "Per-source Lehmer mean of order -1 (L_-1) of per-row total_tokens. L_-1 = sum(x^-1) / sum(x^-2). Extends v0.6.189's Lehmer ladder one step LEFT of HM, completing the symmetric integer Lehmer ladder around AM: L_-1 <= HM <= GM <= AM <= QM <= CHM <= L_3 (Lehmer monotonicity). Equivalently, the x^-2-self-weighted arithmetic mean — each row weights itself by its own INVERSE square. Scale-equivariant, NOT translation-equivariant. Dominated by the SMALLEST rows even more aggressively than HM: a single tiny row pulls L_-1 toward that row's value faster than HM does. Distinct from every existing lens: L-estimators (mid-range / midhinge / trimean / trim-mean-25) are translation- AND scale-equivariant; mad reports a SPREAD; coefficient-of-quartile-deviation / bowley-skewness / iqr-ratio measure SHAPE; coefficient-of-variation / burstiness-coefficient / skewness / kurtosis / gini are MOMENT- or distribution-shape statistics; crest-factor is a dimensionless ratio; harmonic-mean (L_0) weights by 1/x, this lens (L_-1) weights by 1/x^2; lehmer-3-mean (L_3) sits on the OPPOSITE side of AM, dominated by the largest rows. negOneHmGap = HM - L_-1 and negOneAmGap = mean - L_-1 are reported as free signals: ALWAYS >= 0, with magnitude growing as the multiplicative spread of the series grows. Requires every row of every kept source to be strictly positive — sources containing any zero row are surfaced as droppedZeroBearingSources.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n non-negative kept rows; must be an integer >= 1 (default 1)',
    '1',
  )
  .option(
    '--min-lehmer-neg-1-mean <f>',
    'drop sources whose Lehmer L_-1 mean is strictly below f; cohort selector. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'lehmer-neg-1-mean-desc' (default) | 'lehmer-neg-1-mean-asc' | 'mean-desc' | 'hm-gap-desc' (negOneHmGap desc) | 'am-gap-desc' (negOneAmGap desc) | 'rows' | 'source'",
    'lehmer-neg-1-mean-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minLehmerNeg1Mean: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 1) {
          throw new Error(
            `--min-rows must be an integer >= 1 (got ${opts.minRows})`,
          );
        }
        const minLehmerNegOneMean = Number.parseFloat(opts.minLehmerNeg1Mean);
        if (!Number.isFinite(minLehmerNegOneMean) || minLehmerNegOneMean < 0) {
          throw new Error(
            `--min-lehmer-neg-1-mean must be a finite, non-negative number (got ${opts.minLehmerNeg1Mean})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(
              `--top must be a positive integer (got ${opts.top})`,
            );
          }
          top = t;
        }
        const validSorts = [
          'lehmer-neg-1-mean-desc',
          'lehmer-neg-1-mean-asc',
          'mean-desc',
          'hm-gap-desc',
          'am-gap-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenLehmerNegOneMean(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minLehmerNegOneMean,
          top,
          sort: opts.sort as
            | 'lehmer-neg-1-mean-desc'
            | 'lehmer-neg-1-mean-asc'
            | 'mean-desc'
            | 'hm-gap-desc'
            | 'am-gap-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenLehmerNegOneMean(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-row-token-lehmer-neg-2-mean')
  .description(
    "Per-source Lehmer mean of order -2 (L_-2) of per-row total_tokens. L_-2 = sum(x^-2) / sum(x^-3). Extends v0.6.190's Lehmer ladder one step LEFT of L_-1: L_-2 <= L_-1 <= HM <= GM <= AM <= QM <= CHM <= L_3 (Lehmer monotonicity). Equivalently, the x^-3-self-weighted arithmetic mean — each row weights itself by its own INVERSE cube. Scale-equivariant, NOT translation-equivariant. Dominated by the SMALLEST rows even more aggressively than L_-1. negTwoNegOneGap = L_-1 - L_-2, negTwoHmGap = HM - L_-2, negTwoAmGap = mean - L_-2 are reported as free signals: ALWAYS >= 0. Requires every row of every kept source to be strictly positive — sources containing any zero row are surfaced as droppedZeroBearingSources.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n non-negative kept rows; must be an integer >= 1 (default 1)',
    '1',
  )
  .option(
    '--min-lehmer-neg-2-mean <f>',
    'drop sources whose Lehmer L_-2 mean is strictly below f; cohort selector. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'lehmer-neg-2-mean-desc' (default) | 'lehmer-neg-2-mean-asc' | 'mean-desc' | 'neg-one-gap-desc' | 'hm-gap-desc' | 'am-gap-desc' | 'rows' | 'source'",
    'lehmer-neg-2-mean-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minLehmerNeg2Mean: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 1) {
          throw new Error(
            `--min-rows must be an integer >= 1 (got ${opts.minRows})`,
          );
        }
        const minLehmerNegTwoMean = Number.parseFloat(opts.minLehmerNeg2Mean);
        if (!Number.isFinite(minLehmerNegTwoMean) || minLehmerNegTwoMean < 0) {
          throw new Error(
            `--min-lehmer-neg-2-mean must be a finite, non-negative number (got ${opts.minLehmerNeg2Mean})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(
              `--top must be a positive integer (got ${opts.top})`,
            );
          }
          top = t;
        }
        const validSorts = [
          'lehmer-neg-2-mean-desc',
          'lehmer-neg-2-mean-asc',
          'mean-desc',
          'neg-one-gap-desc',
          'hm-gap-desc',
          'am-gap-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenLehmerNegTwoMean(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minLehmerNegTwoMean,
          top,
          sort: opts.sort as
            | 'lehmer-neg-2-mean-desc'
            | 'lehmer-neg-2-mean-asc'
            | 'mean-desc'
            | 'neg-one-gap-desc'
            | 'hm-gap-desc'
            | 'am-gap-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenLehmerNegTwoMean(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );


program
  .command('source-row-token-lehmer-neg-3-mean')
  .description(
    "Per-source Lehmer mean of order -3 (L_-3) of per-row total_tokens. L_-3 = sum(x^-3) / sum(x^-4). Extends v0.6.191's Lehmer ladder one step LEFT of L_-2: L_-3 <= L_-2 <= L_-1 <= HM <= GM <= AM <= QM <= CHM <= L_3 (Lehmer monotonicity). Equivalently, the x^-4-self-weighted arithmetic mean — each row weights itself by its own INVERSE fourth power. Scale-equivariant, NOT translation-equivariant. Dominated by the SMALLEST rows even more aggressively than L_-2. negThreeNegTwoGap = L_-2 - L_-3, negThreeHmGap = HM - L_-3, negThreeAmGap = mean - L_-3 are reported as free signals: ALWAYS >= 0. Requires every row of every kept source to be strictly positive — sources containing any zero row are surfaced as droppedZeroBearingSources.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-rows <n>',
    'drop sources with fewer than n non-negative kept rows; must be an integer >= 1 (default 1)',
    '1',
  )
  .option(
    '--min-lehmer-neg-3-mean <f>',
    'drop sources whose Lehmer L_-3 mean is strictly below f; cohort selector. f must be a finite, non-negative number. (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key: 'lehmer-neg-3-mean-desc' (default) | 'lehmer-neg-3-mean-asc' | 'mean-desc' | 'neg-two-gap-desc' | 'hm-gap-desc' | 'am-gap-desc' | 'rows' | 'source'",
    'lehmer-neg-3-mean-desc',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        minLehmerNeg3Mean: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 1) {
          throw new Error(
            `--min-rows must be an integer >= 1 (got ${opts.minRows})`,
          );
        }
        const minLehmerNegThreeMean = Number.parseFloat(opts.minLehmerNeg3Mean);
        if (!Number.isFinite(minLehmerNegThreeMean) || minLehmerNegThreeMean < 0) {
          throw new Error(
            `--min-lehmer-neg-3-mean must be a finite, non-negative number (got ${opts.minLehmerNeg3Mean})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(
              `--top must be a positive integer (got ${opts.top})`,
            );
          }
          top = t;
        }
        const validSorts = [
          'lehmer-neg-3-mean-desc',
          'lehmer-neg-3-mean-asc',
          'mean-desc',
          'neg-two-gap-desc',
          'hm-gap-desc',
          'am-gap-desc',
          'rows',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRowTokenLehmerNegThreeMean(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          minLehmerNegThreeMean,
          top,
          sort: opts.sort as
            | 'lehmer-neg-3-mean-desc'
            | 'lehmer-neg-3-mean-asc'
            | 'mean-desc'
            | 'neg-two-gap-desc'
            | 'hm-gap-desc'
            | 'am-gap-desc'
            | 'rows'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSourceRowTokenLehmerNegThreeMean(report) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program.parseAsync(process.argv).catch(die);
