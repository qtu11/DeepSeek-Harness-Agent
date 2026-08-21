#!/usr/bin/env node
/**
 * sync-all-to-profile.js
 *
 * Syncs all built workspace packages (@deepseek-ai/*) from packages/* to
 * ~/.dsh/profiles/web/node_modules/@deepseek-ai/
 */

import { cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { execSync } from 'node:child_process'

const PROFILE_DIR = join(homedir(), '.dsh', 'profiles', 'web', 'node_modules', '@deepseek-ai')
const PACKAGES_DIR = resolve(process.cwd(), 'packages')

console.log('=== SYNCING BUILT WORKSPACE PACKAGES TO PROFILE ===')
console.log(`Source: ${PACKAGES_DIR}`)
console.log(`Destination: ${PROFILE_DIR}\n`)

let synced = 0

// Walk packages/*/*
for (const group of readdirSync(PACKAGES_DIR)) {
  const gp = join(PACKAGES_DIR, group)
  if (!statSync(gp).isDirectory()) continue

  for (const pkg of readdirSync(gp)) {
    const pkgPath = join(gp, pkg)
    const pjPath = join(pkgPath, 'package.json')
    const libPath = join(pkgPath, 'lib')

    if (existsSync(pjPath) && existsSync(libPath)) {
      try {
        const pj = JSON.parse(readFileSync(pjPath, 'utf8'))
        const pkgName = pj.name // e.g. @deepseek-ai/dsh-client-locale
        if (pkgName && pkgName.startsWith('@deepseek-ai/')) {
          const shortName = pkgName.replace('@deepseek-ai/', '')
          const targetDir = join(PROFILE_DIR, shortName)

          if (existsSync(targetDir)) {
            // Copy lib folder
            cpSync(libPath, join(targetDir, 'lib'), { recursive: true, force: true })
            synced++
            console.log(`✓ Synced ${pkgName} -> ${targetDir}`)
          }
        }
      } catch (e) {
        console.error(`Error syncing ${pkg}: ${e.message}`)
      }
    }
  }
}

console.log(`\nSynced ${synced} packages successfully.`)

// Now run plugin localizer and tab fixes
console.log('\n=== RUNNING CLEAN LOCALIZATION & TAB FIXES ===')
execSync('node tools/clean-localize-plugins.js', { stdio: 'inherit' })
execSync('node tools/fix-plugin-manager-and-tabs.js', { stdio: 'inherit' })

console.log('\n=== ALL WORKSPACE PACKAGES & PLUGINS FULLY SYNCED ===')
