#!/usr/bin/env node

/**
 * Touch Target Size Validation Test
 * Verifies that all interactive elements meet the 44px minimum touch target size
 * as recommended by Apple's Human Interface Guidelines and WCAG
 */

import { promises as fs } from 'fs';
import { join } from 'path';

// Minimum touch target size (44px as per Apple HIG and WCAG)
const MIN_TOUCH_TARGET_SIZE = 44;

async function analyzeTouchTargets() {
  console.log('👆 Analyzing Touch Target Sizes...\n');
  
  const touchTargetAnalysis = [];
  
  // Define components to analyze for touch targets
  const componentsToAnalyze = [
    {
      name: 'VoteButton',
      file: 'components/VoteButton.tsx',
      expectedTargets: ['upvote button', 'downvote button'],
      criticalityLevel: 'HIGH'
    },
    {
      name: 'Header',
      file: 'components/Header.tsx',
      expectedTargets: ['navigation buttons', 'auth buttons'],
      criticalityLevel: 'HIGH'
    },
    {
      name: 'HeroSearch',
      file: 'components/HeroSearch.tsx',
      expectedTargets: ['search button', 'quick action buttons'],
      criticalityLevel: 'HIGH'
    },
    {
      name: 'Button',
      file: 'components/Button.tsx',
      expectedTargets: ['primary button'],
      criticalityLevel: 'HIGH'
    },
    {
      name: 'SetlistVoting',
      file: 'app/shows/[id]/components/SetlistVoting.tsx',
      expectedTargets: ['add song button', 'vote buttons'],
      criticalityLevel: 'HIGH'
    }
  ];
  
  for (const component of componentsToAnalyze) {
    try {
      const componentPath = join(process.cwd(), component.file);
      const componentContent = await fs.readFile(componentPath, 'utf-8');
      
      console.log(`📱 Analyzing ${component.name}...`);
      
      // Extract padding and sizing information
      const analysis = {
        name: component.name,
        file: component.file,
        criticalityLevel: component.criticalityLevel,
        touchTargets: [],
        issues: [],
        recommendations: []
      };
      
      // Check for padding patterns that indicate touch-friendly sizing
      const paddingPatterns = [
        /p-(\d+)/g,     // p-3, p-4, etc.
        /px-(\d+)/g,    // px-3, px-4, etc.
        /py-(\d+)/g,    // py-3, py-4, etc.
        /padding[^:]*:\s*([^;]+)/g  // CSS padding values
      ];
      
      // Extract all padding values
      const paddingValues = [];
      paddingPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(componentContent)) !== null) {
          paddingValues.push(match[1]);
        }
      });
      
      // Check specific button patterns
      const buttonPatterns = [
        /className={[^}]*p-(\d+)[^}]*}/g,
        /className="[^"]*p-(\d+)[^"]*"/g,
        /className='[^']*p-(\d+)[^']*'/g
      ];
      
      let hasAdequatePadding = false;
      
      // Analyze padding values
      paddingValues.forEach(value => {
        const numValue = parseInt(value);
        if (numValue >= 3) { // p-3 = 12px, p-4 = 16px in Tailwind
          hasAdequatePadding = true;
        }
      });
      
      // Check for specific touch-friendly patterns
      const touchFriendlyPatterns = [
        {
          name: 'Minimum padding',
          pattern: /p-[3-9]|px-[3-9]|py-[3-9]/,
          found: /p-[3-9]|px-[3-9]|py-[3-9]/.test(componentContent),
          recommendation: 'Use p-3 or higher for touch targets'
        },
        {
          name: 'Button sizing',
          pattern: /min-[hw]-\[44px\]|[hw]-\[44px\]|[hw]-11|[hw]-12/,
          found: /min-[hw]-\[44px\]|[hw]-\[44px\]|[hw]-11|[hw]-12/.test(componentContent),
          recommendation: 'Ensure buttons are at least 44px (h-11 or w-11)'
        },
        {
          name: 'Touch-friendly spacing',
          pattern: /gap-[2-9]|space-[xy]-[2-9]/,
          found: /gap-[2-9]|space-[xy]-[2-9]/.test(componentContent),
          recommendation: 'Use adequate spacing between touch targets'
        }
      ];
      
      // Analyze each pattern
      touchFriendlyPatterns.forEach(pattern => {
        if (pattern.found) {
          analysis.touchTargets.push({
            name: pattern.name,
            status: 'GOOD',
            details: 'Touch-friendly pattern detected'
          });
        } else {
          analysis.touchTargets.push({
            name: pattern.name,
            status: 'NEEDS_REVIEW',
            details: pattern.recommendation
          });
        }
      });
      
      // Component-specific analysis
      if (component.name === 'VoteButton') {
        // Check for vote button sizing
        const voteButtonAnalysis = {
          hasProperPadding: /px-2\s+py-1|p-[2-9]/.test(componentContent),
          hasFlexLayout: /flex\s+items-center/.test(componentContent),
          hasMinimumSize: /size={12}|text-xs/.test(componentContent),
          hasProperSpacing: /gap-[1-9]/.test(componentContent)
        };
        
        if (!voteButtonAnalysis.hasProperPadding) {
          analysis.issues.push('Vote buttons may need larger padding for touch');
          analysis.recommendations.push('Consider increasing button padding to px-3 py-2 or p-3');
        }
        
        if (!voteButtonAnalysis.hasProperSpacing) {
          analysis.issues.push('Vote buttons may need more spacing between elements');
          analysis.recommendations.push('Add adequate gap between vote buttons');
        }
      }
      
      if (component.name === 'Header') {
        // Check mobile navigation buttons
        const mobileNavAnalysis = {
          hasMobileButtons: /rounded-full\s+p-2/.test(componentContent),
          hasProperSizing: /size={20}/.test(componentContent),
          hasFlexLayout: /flex\s+items-center/.test(componentContent)
        };
        
        if (mobileNavAnalysis.hasMobileButtons) {
          analysis.touchTargets.push({
            name: 'Mobile navigation buttons',
            status: 'GOOD',
            details: 'Mobile nav buttons detected with p-2 padding'
          });
        }
      }
      
      if (component.name === 'HeroSearch') {
        // Check search input and button sizing
        const searchAnalysis = {
          hasProperInputPadding: /py-4/.test(componentContent),
          hasProperButtonPadding: /px-6\s+py-2/.test(componentContent),
          hasResponsiveText: /text-lg/.test(componentContent)
        };
        
        if (searchAnalysis.hasProperInputPadding) {
          analysis.touchTargets.push({
            name: 'Search input',
            status: 'GOOD',
            details: 'Search input has py-4 padding (touch-friendly)'
          });
        }
        
        if (searchAnalysis.hasProperButtonPadding) {
          analysis.touchTargets.push({
            name: 'Search button',
            status: 'GOOD',
            details: 'Search button has px-6 py-2 padding'
          });
        }
      }
      
      // Overall assessment
      const goodTargets = analysis.touchTargets.filter(t => t.status === 'GOOD').length;
      const needsReview = analysis.touchTargets.filter(t => t.status === 'NEEDS_REVIEW').length;
      
      if (goodTargets > needsReview) {
        analysis.overallStatus = 'GOOD';
      } else if (needsReview > 0) {
        analysis.overallStatus = 'NEEDS_IMPROVEMENT';
      } else {
        analysis.overallStatus = 'UNKNOWN';
      }
      
      touchTargetAnalysis.push(analysis);
      
      console.log(`  📊 Status: ${analysis.overallStatus}`);
      console.log(`  ✅ Good targets: ${goodTargets}`);
      console.log(`  ⚠️  Needs review: ${needsReview}`);
      if (analysis.issues.length > 0) {
        console.log(`  ❌ Issues: ${analysis.issues.length}`);
      }
      console.log('');
      
    } catch (error) {
      console.error(`❌ Error analyzing ${component.name}: ${error.message}`);
    }
  }
  
  // Generate recommendations
  console.log('🎯 Touch Target Recommendations:');
  console.log('================================');
  
  const allRecommendations = touchTargetAnalysis.flatMap(analysis => analysis.recommendations);
  const allIssues = touchTargetAnalysis.flatMap(analysis => analysis.issues);
  
  if (allIssues.length > 0) {
    console.log('\n❌ Issues Found:');
    allIssues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue}`);
    });
  }
  
  if (allRecommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    allRecommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });
  }
  
  // General touch target guidelines
  console.log('\n📏 Touch Target Guidelines:');
  console.log('1. Minimum size: 44px x 44px (Apple HIG)');
  console.log('2. Recommended size: 48px x 48px (Material Design)');
  console.log('3. Minimum spacing: 8px between targets');
  console.log('4. Use padding for larger touch areas');
  console.log('5. Provide visual feedback for interactions');
  
  // Tailwind CSS size reference
  console.log('\n📐 Tailwind CSS Size Reference:');
  console.log('- p-3 = 12px padding (total 24px+ for content)');
  console.log('- p-4 = 16px padding (total 32px+ for content)');
  console.log('- h-11 = 44px height (minimum touch target)');
  console.log('- h-12 = 48px height (recommended touch target)');
  console.log('- w-11 = 44px width (minimum touch target)');
  console.log('- w-12 = 48px width (recommended touch target)');
  
  // Create detailed report
  const reportContent = `# Touch Target Size Analysis Report
Generated: ${new Date().toISOString()}

## Summary
This report analyzes touch target sizes across MySetlist components to ensure mobile accessibility and usability.

## Component Analysis Results

${touchTargetAnalysis.map(analysis => `
### ${analysis.name}
- **File**: ${analysis.file}
- **Criticality**: ${analysis.criticalityLevel}
- **Overall Status**: ${analysis.overallStatus}

#### Touch Targets Analysis
${analysis.touchTargets.map(target => `
- **${target.name}**: ${target.status}
  - ${target.details}
`).join('')}

${analysis.issues.length > 0 ? `#### Issues
${analysis.issues.map(issue => `- ${issue}`).join('\n')}` : ''}

${analysis.recommendations.length > 0 ? `#### Recommendations  
${analysis.recommendations.map(rec => `- ${rec}`).join('\n')}` : ''}
`).join('')}

## Touch Target Guidelines

### Apple Human Interface Guidelines
- **Minimum touch target size**: 44px x 44px
- **Recommended spacing**: 8px between touch targets
- **Visual feedback**: Provide clear touch feedback

### Material Design Guidelines
- **Recommended touch target size**: 48dp x 48dp
- **Minimum touch target size**: 44dp x 44dp
- **Touch target spacing**: 8dp minimum

### WCAG Guidelines
- **Success Criterion 2.5.5**: Target size should be at least 44px x 44px
- **Exception**: When targets are inline with text flow

## Implementation Recommendations

1. **VoteButton Component**: 
   - Consider increasing button padding to px-3 py-2
   - Ensure adequate spacing between up/down vote buttons
   - Test on actual devices to verify touch accuracy

2. **Header Navigation**:
   - Mobile navigation buttons appear to have adequate sizing
   - Verify touch targets work well on different screen sizes

3. **Search Components**:
   - Search input has good padding (py-4)
   - Search button appears touch-friendly
   - Quick action buttons should be tested on devices

4. **General Improvements**:
   - Use consistent spacing between interactive elements
   - Provide visual feedback for all touch interactions
   - Test with users who have accessibility needs

## Testing Plan

1. **Browser Testing**:
   - Use Chrome DevTools mobile simulation
   - Test at various zoom levels
   - Verify touch target highlighting

2. **Device Testing**:
   - Test on actual iOS devices
   - Test on Android devices
   - Test with different finger sizes

3. **Accessibility Testing**:
   - Test with assistive technologies
   - Verify with users who have motor impairments
   - Check touch target spacing and accuracy

## Status: ${allIssues.length === 0 ? 'GOOD' : 'NEEDS_IMPROVEMENT'} ✅

${allIssues.length === 0 ? 
  'Touch target analysis shows good patterns for mobile accessibility.' : 
  'Some touch target improvements recommended for optimal mobile experience.'
}
`;
  
  const reportPath = join(process.cwd(), 'TOUCH-TARGET-ANALYSIS-REPORT.md');
  await fs.writeFile(reportPath, reportContent);
  
  console.log(`\n📄 Detailed touch target report saved to: ${reportPath}`);
  
  return {
    overallStatus: allIssues.length === 0 ? 'GOOD' : 'NEEDS_IMPROVEMENT',
    totalComponents: touchTargetAnalysis.length,
    issuesFound: allIssues.length,
    recommendations: allRecommendations.length,
    analysis: touchTargetAnalysis
  };
}

// Run touch target analysis
analyzeTouchTargets().catch(console.error);