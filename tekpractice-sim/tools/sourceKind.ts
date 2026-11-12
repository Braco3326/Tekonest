/**
 * sourceKind: what kind of page a plan source URL is, for the `kind` of an asset-spec source (Wave 0b finding 5).
 *
 * The first promotion tool stamped every plan URL as `datasheet`, so a retailer page, a manual hosted by a third party or a magazine review
 * read as a manufacturer datasheet in the spec and in the legal register. Now:
 *  - `manual`     a user manual or guide hosted by a manual site (manualslib, manualshive, ...);
 *  - `dealer`     a retailer, rental house or distributor page;
 *  - `datasheet`  a page on the manufacturer's own site (its host carries the manufacturer's name, or a name from MAKER_HOSTS);
 *  - `reference`  anything else (never claimed as a datasheet).
 * Pure; a unit test lists the host classes and checks that no `datasheet` kind sits on a non-manufacturer host.
 */
import type { SpecSourceT } from './assets3d/specSchema'

type Kind = SpecSourceT['kind']

const MANUAL_HOSTS = /(manualslib|manualshive|manuals\.plus|manualowl|manualmachine|manualsdir|manualsonline)/
const DEALER_HOSTS =
  /(zzounds|thomann|adorama|bhphotovideo|markertek|sweetwater|proacousticsusa|fullcompass|crutchfield|canford|chucklevins|sonovente|americanmusical|goknight|avlgear|soundpro|pssl|andertons|woodbrass|reverb|guitarcenter|ldlc|steinigke|proaudiodesign|perfectcircuit|bax-shop|jigsaw24|megasound|solotech|daleproaudio|vintageking|rentex|bswusa|samash|deathcloud|kirstein|proaudiola|frontendaudio|economik|zenitel|westenddj|mediacastsys|performanceaudio|vintagedigital|novelty|4wall|decibel|monthany|dicomp|musson|av-connection|abicart|shopify|mcgrp|la-bs|redco|guitarsanctuary|rentaround|transaudiogroup|avbyfp|musikmesse|target\.com|ebay|amazon)/

/** Manufacturers whose own host does not carry their folded name. */
const MAKER_HOSTS: Readonly<Record<string, readonly string[]>> = {
  'k&m': ['k-m.de'],
  'electro-voice': ['electrovoice'],
  'solid state logic': ['solidstatelogic', 'ssl'],
  'universal audio': ['uaudio'],
  'telos (telos alliance)': ['telosalliance'],
  'telos alliance (axia)': ['telosalliance', 'axiabroadcast'],
  'omnia (telos alliance)': ['telosalliance', 'omniaaudio'],
  'd&b audiotechnik': ['dbaudio'],
  'l-acoustics': ['l-acoustics'],
  'crown (akg/harman)': ['akg', 'crownaudio', 'harmanaudio'],
  'countryman associates': ['countryman'],
  'radial engineering': ['radialeng'],
  'royer labs': ['royerlabs'],
  'neumann': ['neumann'],
  'jk audio': ['jkaudio'],
  'nagra (kudelski)': ['nagraaudio'],
  'heil sound': ['heilsound'],
  'o.c. white': ['ocwhite'],
  'lynx studio technology': ['lynxstudio'],
  'coles electroacoustics': ['coles', 'cole'],
  'sennheiser': ['sennheiser'],
  'tascam': ['tascam'],
  'dbx': ['dbxpro'],
  'tc electronic': ['tcelectronic'],
  'harman': ['harmanaudio'],
  'avid': ['avid'],
  'rtw': ['rtw'],
  'meyer sound': ['meyersound'],
  'aeta audio systems': ['aeta-audio'],
  'apple': ['apple'],
  'allen & heath': ['allen-heath', 'allenheath'],
  audinate: ['getdante', 'audinate'],
  'ams neve': ['ams-neve', 'amsneve'],
}

const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const squash = (s: string): string => fold(s).replace(/[^a-z0-9]+/g, '')

/** The kind of the page at `url` for a product of `manufacturer`. A URL that does not parse is a `reference`. */
export function sourceKind(manufacturer: string, url: string): Kind {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return 'reference'
  }
  if (MANUAL_HOSTS.test(host)) return 'manual'
  if (DEALER_HOSTS.test(host)) return 'dealer'
  const flat = squash(host)
  const names = new Set<string>([squash(manufacturer.replace(/\s*\(.*\)\s*$/, '')), ...(MAKER_HOSTS[fold(manufacturer)] ?? []).map(squash)])
  for (const n of names) if (n.length >= 3 && flat.includes(n)) return 'datasheet'
  return 'reference'
}
