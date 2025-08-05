import { useState, useEffect } from 'react';
import { getApiReleasesUrl } from '../utils/repository';

export interface GitHubAsset {
  id: number;
  name: string;
  label?: string;
  content_type: string;
  size: number;
  download_count: number;
  browser_download_url: string;
  created_at: string;
  updated_at: string;
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string;
  assets: GitHubAsset[];
  html_url: string;
  tarball_url: string;
  zipball_url: string;
}

export interface DownloadLink {
  platform: 'macOS' | 'Windows' | 'Linux';
  architecture?: 'x64' | 'arm64' | 'universal';
  filename: string;
  size: string;
  downloadUrl: string;
  type: 'installer' | 'portable' | 'dmg' | 'appimage' | 'deb';
  releaseVersion: string;
  releaseDate: string;
}

export const useGithubReleases = () => {
  const [releases, setReleases] = useState<GitHubRelease[]>([]);
  const [latestRelease, setLatestRelease] = useState<GitHubRelease | null>(null);
  const [downloadLinks, setDownloadLinks] = useState<DownloadLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatFileSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const parseDownloadLinks = (release: GitHubRelease): DownloadLink[] => {
    const links: DownloadLink[] = [];

    release.assets.forEach((asset) => {
      const filename = asset.name.toLowerCase();

      // macOS
      if (filename.includes('.dmg')) {
        links.push({
          platform: 'macOS',
          architecture: filename.includes('universal')
            ? 'universal'
            : filename.includes('arm64')
              ? 'arm64'
              : 'x64',
          filename: asset.name,
          size: formatFileSize(asset.size),
          downloadUrl: asset.browser_download_url,
          type: 'dmg',
          releaseVersion: release.tag_name,
          releaseDate: release.published_at,
        });
      }

      // Windows
      else if (filename.includes('.exe') || filename.includes('.msi')) {
        links.push({
          platform: 'Windows',
          architecture: filename.includes('arm64') ? 'arm64' : 'x64',
          filename: asset.name,
          size: formatFileSize(asset.size),
          downloadUrl: asset.browser_download_url,
          type: 'installer',
          releaseVersion: release.tag_name,
          releaseDate: release.published_at,
        });
      }

      // Linux AppImage
      else if (filename.includes('.appimage')) {
        links.push({
          platform: 'Linux',
          architecture: filename.includes('arm64') ? 'arm64' : 'x64',
          filename: asset.name,
          size: formatFileSize(asset.size),
          downloadUrl: asset.browser_download_url,
          type: 'appimage',
          releaseVersion: release.tag_name,
          releaseDate: release.published_at,
        });
      }

      // Linux DEB
      else if (filename.includes('.deb')) {
        links.push({
          platform: 'Linux',
          architecture: filename.includes('arm64') ? 'arm64' : 'x64',
          filename: asset.name,
          size: formatFileSize(asset.size),
          downloadUrl: asset.browser_download_url,
          type: 'deb',
          releaseVersion: release.tag_name,
          releaseDate: release.published_at,
        });
      }
    });

    return links;
  };

  const fetchReleases = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(getApiReleasesUrl());

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data: GitHubRelease[] = await response.json();

      // Filter to stable releases (not drafts or prereleases) and limit to latest 5
      const stableReleases = data
        .filter((release) => !release.prerelease && !release.draft)
        .slice(0, 5);

      setReleases(stableReleases);

      if (stableReleases.length > 0) {
        setLatestRelease(stableReleases[0]);

        // Create download links for all stable releases
        const allDownloadLinks: DownloadLink[] = [];
        stableReleases.forEach((release) => {
          const releaseLinks = parseDownloadLinks(release);
          allDownloadLinks.push(...releaseLinks);
        });

        setDownloadLinks(allDownloadLinks);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch releases');
    } finally {
      setLoading(false);
    }
  };

  const refetch = () => {
    fetchReleases();
  };

  useEffect(() => {
    fetchReleases();
  }, []);

  return {
    releases,
    latestRelease,
    downloadLinks,
    loading,
    error,
    refetch,
  };
};
