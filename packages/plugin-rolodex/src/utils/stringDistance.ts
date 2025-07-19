/**
 * Calculate the Levenshtein distance between two strings
 * This measures the minimum number of single-character edits required
 * to change one string into the other
 *
 * @param str1 First string
 * @param str2 Second string
 * @returns The Levenshtein distance
 */
export function calculateLevenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  // Create a 2D array for dynamic programming
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize base cases
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  // Fill the dp table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity score between two strings based on Levenshtein distance
 *
 * @param str1 First string
 * @param str2 Second string
 * @returns Similarity score between 0 and 1 (1 being identical)
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  const distance = calculateLevenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);

  if (maxLength === 0) {
    return 1;
  } // Both strings are empty

  return 1 - distance / maxLength;
}

/**
 * Find the best matching string from a list of candidates
 *
 * @param target The target string to match
 * @param candidates List of candidate strings
 * @param threshold Minimum similarity threshold (0-1)
 * @returns The best match and its similarity score, or null if no match meets threshold
 */
export function findBestMatch(
  target: string,
  candidates: string[],
  threshold: number = 0.7
): { match: string; similarity: number } | null {
  let bestMatch: string | null = null;
  let bestSimilarity = 0;

  for (const candidate of candidates) {
    const similarity = calculateStringSimilarity(target.toLowerCase(), candidate.toLowerCase());

    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = candidate;
    }
  }

  if (bestMatch && bestSimilarity >= threshold) {
    return { match: bestMatch, similarity: bestSimilarity };
  }

  return null;
}

/**
 * Check if a string contains another string with fuzzy matching
 *
 * @param haystack The string to search in
 * @param needle The string to search for
 * @param maxDistance Maximum allowed Levenshtein distance
 * @returns True if a fuzzy match is found
 */
export function fuzzyContains(haystack: string, needle: string, maxDistance: number = 2): boolean {
  const haystackLower = haystack.toLowerCase();
  const needleLower = needle.toLowerCase();

  // Sliding window approach
  for (let i = 0; i <= haystackLower.length - needleLower.length; i++) {
    const substring = haystackLower.substring(i, i + needleLower.length);
    const distance = calculateLevenshteinDistance(substring, needleLower);

    if (distance <= maxDistance) {
      return true;
    }
  }

  return false;
}

/**
 * Extract potential nicknames or aliases from a full name
 *
 * @param fullName The full name
 * @returns Array of potential nicknames
 */
export function extractNicknames(fullName: string): string[] {
  const nicknames: string[] = [fullName];
  const parts = fullName.split(/\s+/);

  // Add first name
  if (parts.length > 0) {
    nicknames.push(parts[0]);
  }

  // Add last name if exists
  if (parts.length > 1) {
    nicknames.push(parts[parts.length - 1]);
  }

  // Add initials
  if (parts.length > 1) {
    const initials = parts.map((p) => p[0]).join('');
    nicknames.push(initials);
  }

  // Add first name + last initial
  if (parts.length > 1) {
    nicknames.push(`${parts[0]} ${parts[parts.length - 1][0]}`);
  }

  return [...new Set(nicknames)]; // Remove duplicates
}
