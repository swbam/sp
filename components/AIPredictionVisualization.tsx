'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { twMerge } from 'tailwind-merge';
import { 
  BiBrain, 
  BiTrendingUp, 
  BiBarChartAlt2, 
  BiInfoCircle,
  BiRefresh,
  BiStar,
  BiTime,
  BiMusic
} from 'react-icons/bi';
import { FaRobot, FaChartLine, FaLightbulb } from 'react-icons/fa';
import type { SetlistSongWithDetails, Artist, Show } from '@/types';

interface PredictionData {
  songId: string;
  title: string;
  artist: string;
  probability: number;
  confidence: number;
  reasoning: string[];
  historicalData: {
    timesPlayed: number;
    lastPlayed?: string;
    averagePosition: number;
    tournamePosition?: number;
  };
  factors: {
    recentPerformances: number;
    fanDemand: number;
    setPosition: number;
    albumRelease: number;
    seasonality: number;
  };
}

interface AIPredictionVisualizationProps {
  predictions: PredictionData[];
  artist: Artist;
  show?: Show;
  className?: string;
  showDetails?: boolean;
  interactive?: boolean;
  onPredictionClick?: (prediction: PredictionData) => void;
  refreshPredictions?: () => Promise<void>;
}

export const AIPredictionVisualization: React.FC<AIPredictionVisualizationProps> = ({
  predictions,
  artist,
  show,
  className,
  showDetails = true,
  interactive = true,
  onPredictionClick,
  refreshPredictions
}) => {
  const [selectedPrediction, setSelectedPrediction] = useState<PredictionData | null>(null);
  const [sortBy, setSortBy] = useState<'probability' | 'confidence' | 'position'>('probability');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFactorBreakdown, setShowFactorBreakdown] = useState(false);

  // Sort predictions based on selected criteria
  const sortedPredictions = useMemo(() => {
    return [...predictions].sort((a, b) => {
      switch (sortBy) {
        case 'probability':
          return b.probability - a.probability;
        case 'confidence':
          return b.confidence - a.confidence;
        case 'position':
          return a.historicalData.averagePosition - b.historicalData.averagePosition;
        default:
          return b.probability - a.probability;
      }
    });
  }, [predictions, sortBy]);

  // Calculate overall prediction metrics
  const metrics = useMemo(() => {
    const avgProbability = predictions.reduce((sum, p) => sum + p.probability, 0) / predictions.length;
    const avgConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;
    const highConfidencePredictions = predictions.filter(p => p.confidence > 0.8).length;
    
    return {
      avgProbability,
      avgConfidence,
      highConfidencePredictions,
      totalPredictions: predictions.length
    };
  }, [predictions]);

  // Handle refresh
  const handleRefresh = async () => {
    if (!refreshPredictions) return;
    
    setIsRefreshing(true);
    try {
      await refreshPredictions();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Get probability color
  const getProbabilityColor = (probability: number) => {
    if (probability >= 0.8) return 'text-green-400 bg-green-400/20';
    if (probability >= 0.6) return 'text-yellow-400 bg-yellow-400/20';
    if (probability >= 0.4) return 'text-orange-400 bg-orange-400/20';
    return 'text-red-400 bg-red-400/20';
  };

  // Get confidence indicator
  const getConfidenceIndicator = (confidence: number) => {
    if (confidence >= 0.9) return { icon: BiStar, color: 'text-purple-400', label: 'Very High' };
    if (confidence >= 0.7) return { icon: BiTrendingUp, color: 'text-blue-400', label: 'High' };
    if (confidence >= 0.5) return { icon: BiBarChartAlt2, color: 'text-yellow-400', label: 'Medium' };
    return { icon: BiInfoCircle, color: 'text-gray-400', label: 'Low' };
  };

  // Render factor visualization
  const renderFactorBar = (factor: keyof PredictionData['factors'], value: number, label: string) => {
    const percentage = Math.round(value * 100);
    const color = value >= 0.7 ? 'bg-green-500' : value >= 0.4 ? 'bg-yellow-500' : 'bg-red-500';
    
    return (
      <div key={factor} className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-xs text-neutral-400">{label}</span>
          <span className="text-xs font-medium text-white">{percentage}%</span>
        </div>
        <div className="h-2 bg-neutral-700 rounded-full overflow-hidden">
          <motion.div
            className={twMerge("h-full rounded-full", color)}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.5, delay: 0.1 }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className={twMerge("bg-neutral-800/50 rounded-lg border border-neutral-700", className)}>
      {/* Header */}
      <div className="p-6 border-b border-neutral-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <FaRobot size={24} className="text-purple-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">AI Setlist Predictions</h3>
              <p className="text-sm text-neutral-400">
                Powered by machine learning analysis of {artist.name}&apos;s performance history
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {refreshPredictions && (
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={twMerge(
                  "p-2 rounded-lg bg-neutral-700 hover:bg-neutral-600",
                  "text-neutral-400 hover:text-white transition-colors",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  isRefreshing && "animate-spin"
                )}
                aria-label="Refresh predictions"
              >
                <BiRefresh size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Metrics Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-neutral-700/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <BiBrain size={16} className="text-purple-400" />
              <span className="text-xs text-neutral-400">Avg Probability</span>
            </div>
            <span className="text-lg font-bold text-white">
              {Math.round(metrics.avgProbability * 100)}%
            </span>
          </div>
          
          <div className="bg-neutral-700/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <BiBarChartAlt2 size={16} className="text-blue-400" />
              <span className="text-xs text-neutral-400">Avg Confidence</span>
            </div>
            <span className="text-lg font-bold text-white">
              {Math.round(metrics.avgConfidence * 100)}%
            </span>
          </div>
          
          <div className="bg-neutral-700/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <BiStar size={16} className="text-yellow-400" />
              <span className="text-xs text-neutral-400">High Confidence</span>
            </div>
            <span className="text-lg font-bold text-white">
              {metrics.highConfidencePredictions}
            </span>
          </div>
          
          <div className="bg-neutral-700/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <BiMusic size={16} className="text-green-400" />
              <span className="text-xs text-neutral-400">Total Songs</span>
            </div>
            <span className="text-lg font-bold text-white">
              {metrics.totalPredictions}
            </span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 border-b border-neutral-700">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-400">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-neutral-700 border border-neutral-600 rounded px-3 py-1 text-white text-sm"
            >
              <option value="probability">Probability</option>
              <option value="confidence">Confidence</option>
              <option value="position">Historical Position</option>
            </select>
          </div>

          <button
            onClick={() => setShowFactorBreakdown(!showFactorBreakdown)}
            className={twMerge(
              "text-sm px-3 py-1 rounded-lg transition-colors",
              showFactorBreakdown 
                ? "bg-purple-500 text-white" 
                : "bg-neutral-700 text-neutral-400 hover:text-white"
            )}
          >
            {showFactorBreakdown ? 'Hide' : 'Show'} Factors
          </button>
        </div>
      </div>

      {/* Predictions List */}
      <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
        <AnimatePresence>
          {sortedPredictions.map((prediction, index) => {
            const confidenceIndicator = getConfidenceIndicator(prediction.confidence);
            const probabilityColor = getProbabilityColor(prediction.probability);
            
            return (
              <motion.div
                key={prediction.songId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={twMerge(
                  "bg-neutral-700/30 rounded-lg p-4 border border-neutral-600",
                  "hover:bg-neutral-700/50 transition-all duration-200",
                  interactive && "cursor-pointer",
                  selectedPrediction?.songId === prediction.songId && "ring-2 ring-purple-500/50"
                )}
                onClick={() => {
                  if (interactive) {
                    setSelectedPrediction(prediction);
                    onPredictionClick?.(prediction);
                  }
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Song Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-white truncate">
                        {prediction.title}
                      </h4>
                      <confidenceIndicator.icon 
                        size={16} 
                        className={confidenceIndicator.color}
                        title={`${confidenceIndicator.label} confidence`}
                      />
                    </div>
                    <p className="text-sm text-neutral-400 mb-2">
                      {prediction.artist}
                    </p>

                    {/* Historical Data */}
                    <div className="flex items-center gap-4 text-xs text-neutral-500">
                      <span>Played {prediction.historicalData.timesPlayed} times</span>
                      <span>Avg position: #{prediction.historicalData.averagePosition}</span>
                      {prediction.historicalData.lastPlayed && (
                        <span>Last: {new Date(prediction.historicalData.lastPlayed).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>

                  {/* Probability */}
                  <div className="text-right">
                    <div className={twMerge(
                      "inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium",
                      probabilityColor
                    )}>
                      <span>{Math.round(prediction.probability * 100)}%</span>
                    </div>
                    <div className="text-xs text-neutral-400 mt-1">
                      {confidenceIndicator.label} confidence
                    </div>
                  </div>
                </div>

                {/* Factor Breakdown */}
                <AnimatePresence>
                  {showFactorBreakdown && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-4 pt-4 border-t border-neutral-600"
                    >
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {renderFactorBar('recentPerformances', prediction.factors.recentPerformances, 'Recent Performances')}
                        {renderFactorBar('fanDemand', prediction.factors.fanDemand, 'Fan Demand')}
                        {renderFactorBar('setPosition', prediction.factors.setPosition, 'Set Position')}
                        {renderFactorBar('albumRelease', prediction.factors.albumRelease, 'Album Recency')}
                        {renderFactorBar('seasonality', prediction.factors.seasonality, 'Seasonality')}
                      </div>

                      {prediction.reasoning.length > 0 && (
                        <div className="mt-3">
                          <div className="flex items-center gap-2 mb-2">
                            <FaLightbulb size={14} className="text-yellow-400" />
                            <span className="text-xs font-medium text-neutral-300">AI Reasoning</span>
                          </div>
                          <ul className="space-y-1">
                            {prediction.reasoning.map((reason, idx) => (
                              <li key={idx} className="text-xs text-neutral-400 flex items-start gap-2">
                                <span className="text-neutral-600 mt-0.5">•</span>
                                <span>{reason}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-neutral-700">
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <FaChartLine size={14} />
            <span>
              Predictions updated {show ? `for ${show.name}` : 'recently'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <BiTime size={14} />
            <span>Refreshed {new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};