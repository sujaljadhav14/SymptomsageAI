/**
 * Offline Health Assessment Engine
 * 
 * A rule-based expert system for pre-clinical health assessment.
 * Works completely offline using local JSON data files.
 * 
 * NO machine learning, NO external APIs, fully explainable.
 */

import {
    SymptomData,
    ConditionData,
    TestData,
    RedFlagData,
    AssessmentInput,
    AssessmentResult,
    ConditionMatch,
    TestSuggestion
} from '../types';

// Import local data files
import symptomsData from '../data/symptoms.json';
import conditionsData from '../data/conditions.json';
import testsData from '../data/tests.json';
import redFlagsData from '../data/redflags.json';

// Type assertions for imported JSON
const symptoms = symptomsData as Record<string, SymptomData>;
const conditions = conditionsData as Record<string, ConditionData>;
const tests = testsData as Record<string, TestData>;
const redFlags = redFlagsData as RedFlagData;

// ============================================
// INPUT NORMALIZATION
// ============================================

const NOISE_WORDS = new Set([
    'i', 'am', 'have', 'having', 'got', 'feel', 'feeling', 'been',
    'a', 'an', 'the', 'my', 'me', 'for', 'with', 'and', 'or', 'but',
    'very', 'really', 'quite', 'some', 'bit', 'little', 'lot',
    'since', 'from', 'about', 'like', 'just', 'also', 'too'
]);

const SYMPTOM_ALIASES: Record<string, string> = {
    'stomach ache': 'abdominal_pain',
    'stomach pain': 'abdominal_pain',
    'tummy ache': 'abdominal_pain',
    'belly pain': 'abdominal_pain',
    'head hurts': 'headache',
    'head pain': 'headache',
    'throwing up': 'vomiting',
    'puking': 'vomiting',
    'loose motion': 'diarrhea',
    'loose stool': 'diarrhea',
    'running nose': 'runny_nose',
    'stuffy nose': 'runny_nose',
    'cant sleep': 'insomnia',
    'no sleep': 'insomnia',
    'tired': 'fatigue',
    'exhausted': 'fatigue',
    'weak': 'fatigue',
    'dizzy': 'dizziness',
    'giddy': 'dizziness',
    'lightheaded': 'dizziness',
    'breathless': 'shortness_of_breath',
    'breathing problem': 'shortness_of_breath',
    'joint ache': 'joint_pain',
    'body pain': 'body_aches',
    'muscle pain': 'body_aches',
    'sore body': 'body_aches',
    'heart racing': 'palpitations',
    'heart pounding': 'palpitations',
    'fast heartbeat': 'palpitations',
    'peeing a lot': 'frequent_urination',
    'urinating often': 'frequent_urination',
    'painful urination': 'burning_urination',
    'burning pee': 'burning_urination',
    'no appetite': 'loss_of_appetite',
    'not hungry': 'loss_of_appetite',
    'cant taste': 'loss_of_taste',
    'cant smell': 'loss_of_smell',
    'skin rash': 'rash',
    'itchy skin': 'rash',
    'acid reflux': 'heartburn',
    'acidity': 'heartburn',
    'indigestion': 'heartburn',
    'gas': 'bloating',
    'bloated': 'bloating',
    'sweaty': 'sweating',
    'night sweats': 'sweating',
    'shivering': 'chills',
    'cold chills': 'chills'
};

/**
 * Normalizes user input text to extract symptom keywords
 */
export function normalizeInput(text: string): string[] {
    // Lowercase and clean
    let cleaned = text.toLowerCase()
        .replace(/[^a-z\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // Check for known aliases first
    for (const [alias, symptom] of Object.entries(SYMPTOM_ALIASES)) {
        if (cleaned.includes(alias)) {
            cleaned = cleaned.replace(alias, symptom.replace(/_/g, ' '));
        }
    }

    // Split into words and filter noise
    const words = cleaned.split(' ')
        .filter(word => word.length > 2 && !NOISE_WORDS.has(word));

    // Match against known symptoms
    const matchedSymptoms = new Set<string>();

    for (const word of words) {
        // Direct match
        const symptomKey = word.replace(/\s+/g, '_');
        if (symptoms[symptomKey]) {
            matchedSymptoms.add(symptomKey);
            continue;
        }

        // Partial match
        for (const knownSymptom of Object.keys(symptoms)) {
            if (knownSymptom.includes(word) || word.includes(knownSymptom.replace(/_/g, ''))) {
                matchedSymptoms.add(knownSymptom);
            }
        }
    }

    // Also check two-word combinations
    for (let i = 0; i < words.length - 1; i++) {
        const twoWord = `${words[i]}_${words[i + 1]}`;
        if (symptoms[twoWord]) {
            matchedSymptoms.add(twoWord);
        }
    }

    return Array.from(matchedSymptoms);
}

// ============================================
// RED FLAG DETECTION (PRIORITY)
// ============================================

/**
 * Checks if any symptoms are red flags requiring emergency care
 */
export function checkRedFlags(userSymptoms: string[], rawInput?: string): {
    isEmergency: boolean;
    matchedFlags: string[];
    message: string;
    instructions: string[];
} {
    const matchedFlags: string[] = [];

    // Check direct symptom matches
    for (const symptom of userSymptoms) {
        if (redFlags.symptoms.includes(symptom)) {
            matchedFlags.push(symptom);
        }
    }

    // Check keyword matches in raw input
    if (rawInput) {
        const lowerInput = rawInput.toLowerCase();
        for (const [flag, keywords] of Object.entries(redFlags.keywords)) {
            if (!matchedFlags.includes(flag)) {
                for (const keyword of keywords) {
                    if (lowerInput.includes(keyword)) {
                        matchedFlags.push(flag);
                        break;
                    }
                }
            }
        }
    }

    return {
        isEmergency: matchedFlags.length > 0,
        matchedFlags,
        message: redFlags.emergencyMessage,
        instructions: redFlags.instructions
    };
}

// ============================================
// SYMPTOM MATCHING
// ============================================

/**
 * Matches symptoms to possible conditions
 */
export function matchSymptoms(userSymptoms: string[]): Map<string, {
    matchedSymptoms: string[];
    isKeySymptom: boolean[];
}> {
    const conditionMatches = new Map<string, {
        matchedSymptoms: string[];
        isKeySymptom: boolean[];
    }>();

    for (const symptom of userSymptoms) {
        const symptomData = symptoms[symptom];
        if (!symptomData) continue;

        for (const conditionId of symptomData.conditions) {
            const existing = conditionMatches.get(conditionId) || {
                matchedSymptoms: [],
                isKeySymptom: []
            };

            existing.matchedSymptoms.push(symptom);
            existing.isKeySymptom.push(symptomData.isKeySymptom.includes(conditionId));

            conditionMatches.set(conditionId, existing);
        }
    }

    return conditionMatches;
}

// ============================================
// CONDITION SCORING
// ============================================

const RISK_SCORE_MODIFIER: Record<string, number> = {
    'low': 0,
    'moderate': 1,
    'high': 3
};

/**
 * Scores and ranks conditions based on symptom matches
 */
export function scoreConditions(
    matches: Map<string, { matchedSymptoms: string[]; isKeySymptom: boolean[] }>,
    totalUserSymptoms: number
): ConditionMatch[] {
    const scoredConditions: ConditionMatch[] = [];

    for (const [conditionId, match] of matches) {
        const conditionData = conditions[conditionId];
        if (!conditionData) continue;

        // Base score: 1 point per matched symptom
        let score = match.matchedSymptoms.length;

        // Bonus for key symptoms: +2 per key symptom
        const keySymptomCount = match.isKeySymptom.filter(Boolean).length;
        score += keySymptomCount * 2;

        // Risk modifier
        score += RISK_SCORE_MODIFIER[conditionData.riskLevel] || 0;

        // Symptom coverage bonus (if user has many of condition's symptoms)
        const coverageRatio = match.matchedSymptoms.length / conditionData.commonSymptoms.length;
        if (coverageRatio > 0.5) {
            score += 2;
        }

        // Determine confidence
        let confidence: 'possible' | 'likely' | 'very_likely' = 'possible';
        if (match.matchedSymptoms.length >= 3 && keySymptomCount >= 1) {
            confidence = 'very_likely';
        } else if (match.matchedSymptoms.length >= 2 || keySymptomCount >= 1) {
            confidence = 'likely';
        }

        scoredConditions.push({
            conditionId,
            name: conditionData.name,
            score,
            matchedSymptoms: match.matchedSymptoms,
            riskLevel: conditionData.riskLevel,
            description: conditionData.description,
            confidence
        });
    }

    // Sort by score (descending)
    scoredConditions.sort((a, b) => b.score - a.score);

    // Return top 3
    return scoredConditions.slice(0, 3);
}

// ============================================
// TEST SUGGESTIONS
// ============================================

/**
 * Suggests tests based on matched conditions
 */
export function suggestTests(topConditions: ConditionMatch[]): TestSuggestion[] {
    const testMap = new Map<string, TestSuggestion>();

    for (const condition of topConditions) {
        const conditionData = conditions[condition.conditionId];
        if (!conditionData) continue;

        for (const testId of conditionData.tests) {
            const testData = tests[testId];
            if (!testData) continue;

            const existing = testMap.get(testId);
            if (existing) {
                // Add condition to relevance list
                existing.relevantConditions.push(condition.name);
                // Upgrade priority if linked to high-risk condition
                if (condition.riskLevel === 'high' && existing.priority !== 'specialized') {
                    existing.priority = 'diagnostic';
                }
            } else {
                testMap.set(testId, {
                    testId,
                    name: testData.name,
                    cost: testData.cost,
                    priority: condition.riskLevel === 'high' ? 'diagnostic' : testData.priority,
                    reason: testData.reason,
                    relevantConditions: [condition.name]
                });
            }
        }
    }

    // Convert to array and sort by priority then cost
    const sortedTests = Array.from(testMap.values());

    const priorityOrder = { 'screening': 0, 'diagnostic': 1, 'specialized': 2 };
    const costOrder = { 'low': 0, 'medium': 1, 'high': 2 };

    sortedTests.sort((a, b) => {
        // Prefer lower priority (screening first)
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        // Then prefer lower cost
        return costOrder[a.cost] - costOrder[b.cost];
    });

    return sortedTests.slice(0, 5); // Max 5 tests
}

// ============================================
// RESPONSE GENERATION
// ============================================

/**
 * Generates human-readable reasoning strings
 */
function generateReasoning(
    topConditions: ConditionMatch[],
    matchedSymptoms: string[]
): string[] {
    const reasoning: string[] = [];

    reasoning.push(
        `Based on your reported symptoms (${matchedSymptoms.map(s => s.replace(/_/g, ' ')).join(', ')}), we analyzed potential conditions.`
    );

    for (const condition of topConditions) {
        const symptomList = condition.matchedSymptoms.map(s => s.replace(/_/g, ' ')).join(', ');
        reasoning.push(
            `${condition.name} was considered because you reported: ${symptomList}. This is ${condition.confidence === 'very_likely' ? 'a strong match' : condition.confidence === 'likely' ? 'a likely match' : 'a possible match'}.`
        );
    }

    return reasoning;
}

/**
 * Generates next step recommendations
 */
function generateNextSteps(
    riskLevel: 'low' | 'moderate' | 'high' | 'emergency',
    hasHighRiskCondition: boolean
): string[] {
    const steps: string[] = [];

    if (riskLevel === 'emergency') {
        steps.push('Seek immediate emergency medical care');
        steps.push('Call 911 or go to the nearest emergency room');
        steps.push('Do not wait to see if symptoms improve');
    } else if (riskLevel === 'high' || hasHighRiskCondition) {
        steps.push('Schedule an appointment with a doctor within 24-48 hours');
        steps.push('If symptoms worsen, seek immediate medical attention');
        steps.push('Avoid self-medication without professional guidance');
    } else if (riskLevel === 'moderate') {
        steps.push('Consider scheduling a doctor\'s appointment this week');
        steps.push('Monitor your symptoms and note any changes');
        steps.push('Rest and stay hydrated');
    } else {
        steps.push('Monitor your symptoms over the next few days');
        steps.push('Try home remedies appropriate for your symptoms');
        steps.push('If symptoms persist beyond a week, consult a doctor');
    }

    steps.push('Keep a record of your symptoms and their progression');

    return steps;
}

// ============================================
// MAIN ASSESSMENT FUNCTION
// ============================================

const DISCLAIMER = `⚠️ IMPORTANT: This assessment is for informational purposes only and does NOT constitute a medical diagnosis. Always consult a qualified healthcare professional for proper diagnosis and treatment. In case of emergency, call 911 immediately.`;

/**
 * Main function to run the health assessment
 */
export function runAssessment(input: AssessmentInput): AssessmentResult {
    const { symptoms: selectedSymptoms, duration, severity, additionalNotes } = input;

    // Normalize any additional text input
    const additionalSymptoms = additionalNotes ? normalizeInput(additionalNotes) : [];
    const allSymptoms = [...new Set([...selectedSymptoms, ...additionalSymptoms])];

    // Find unmatched symptoms (from selection that weren't in our database)
    const knownSymptoms = Object.keys(symptoms);
    const matchedSymptoms = allSymptoms.filter(s => knownSymptoms.includes(s));
    const unmatchedSymptoms = allSymptoms.filter(s => !knownSymptoms.includes(s));

    // Check for red flags FIRST
    const redFlagCheck = checkRedFlags(matchedSymptoms, additionalNotes);
    if (redFlagCheck.isEmergency) {
        return {
            riskLevel: 'emergency',
            isEmergency: true,
            possibleConditions: [],
            reasoning: [
                `🚨 EMERGENCY DETECTED: You reported symptoms that require immediate medical attention.`,
                `Matched emergency indicators: ${redFlagCheck.matchedFlags.map(f => f.replace(/_/g, ' ')).join(', ')}`
            ],
            testSuggestions: [],
            nextSteps: redFlagCheck.instructions,
            matchedSymptoms,
            unmatchedSymptoms,
            disclaimer: DISCLAIMER,
            timestamp: new Date()
        };
    }

    // Match symptoms to conditions
    const conditionMatches = matchSymptoms(matchedSymptoms);

    // Score and rank conditions
    const topConditions = scoreConditions(conditionMatches, matchedSymptoms.length);

    // If no matches found
    if (topConditions.length === 0) {
        return {
            riskLevel: 'low',
            isEmergency: false,
            possibleConditions: [],
            reasoning: [
                'We could not identify specific conditions matching your symptoms.',
                'This may mean your symptoms are very general or not in our current database.',
                'Please consult a healthcare provider for a proper evaluation.'
            ],
            testSuggestions: [{
                testId: 'physical_exam',
                name: 'Physical Examination',
                cost: 'low',
                priority: 'screening',
                reason: 'A general checkup can help identify underlying causes',
                relevantConditions: ['General Assessment']
            }],
            nextSteps: [
                'Schedule a general health checkup with your doctor',
                'Monitor your symptoms and note any changes',
                'Maintain a healthy lifestyle with proper rest and hydration'
            ],
            matchedSymptoms,
            unmatchedSymptoms,
            disclaimer: DISCLAIMER,
            timestamp: new Date()
        };
    }

    // Suggest tests
    const testSuggestions = suggestTests(topConditions);

    // Determine overall risk level
    const hasHighRisk = topConditions.some(c => c.riskLevel === 'high');
    const hasModerateRisk = topConditions.some(c => c.riskLevel === 'moderate');
    let riskLevel: 'low' | 'moderate' | 'high' = 'low';
    if (hasHighRisk) riskLevel = 'high';
    else if (hasModerateRisk) riskLevel = 'moderate';

    // Adjust risk based on severity input
    if (severity === 'severe' && riskLevel === 'low') {
        riskLevel = 'moderate';
    }

    // Generate reasoning
    const reasoning = generateReasoning(topConditions, matchedSymptoms);

    // Generate next steps
    const nextSteps = generateNextSteps(riskLevel, hasHighRisk);

    return {
        riskLevel,
        isEmergency: false,
        possibleConditions: topConditions,
        reasoning,
        testSuggestions,
        nextSteps,
        matchedSymptoms,
        unmatchedSymptoms,
        disclaimer: DISCLAIMER,
        timestamp: new Date()
    };
}

// ============================================
// SYMPTOM LIST HELPER
// ============================================

/**
 * Returns a list of all known symptoms for UI selection
 */
export function getAllSymptoms(): { id: string; label: string }[] {
    return Object.keys(symptoms).map(id => ({
        id,
        label: id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }));
}

/**
 * Get common/frequently reported symptoms
 */
export function getCommonSymptoms(): { id: string; label: string }[] {
    const common = [
        'headache', 'fever', 'cough', 'fatigue', 'body_aches',
        'sore_throat', 'runny_nose', 'nausea', 'diarrhea', 'dizziness',
        'abdominal_pain', 'back_pain', 'joint_pain', 'shortness_of_breath'
    ];
    return common.map(id => ({
        id,
        label: id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }));
}
