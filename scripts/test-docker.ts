#!/usr/bin/env bun
/**
 * test-docker.ts — Reproduce CI (Ubuntu/Linux) test environment locally via Docker.
 *
 * USAGE:
 *   1. First push the latest code to GitHub:
 *        t44 push --git FramespaceGenesis
 *
 *   2. Run this script:
 *        bun scripts/test-docker.ts
 *
 *      This will:
 *        a) Clone git@github.com:Stream44/FramespaceGenesis.git into scripts/.~repo/
 *        b) Copy the Dockerfile into the cloned repo
 *        c) Build a Docker image 'framespace-genesis-test'
 *        d) Run the tests inside the container
 *
 *   3. To inspect the container interactively:
 *        bun scripts/test-docker.ts --shell
 *
 *      This drops you into a bash shell inside the container so you can
 *      inspect node_modules, run individual tests, check file paths, etc.
 *
 *   4. To rebuild without cache:
 *        bun scripts/test-docker.ts --no-cache
 *
 *   5. To skip clone (reuse existing .~repo):
 *        bun scripts/test-docker.ts --skip-clone
 */

import { join, dirname } from 'path'
import { existsSync } from 'fs'
import { rm, cp, mkdir } from 'fs/promises'

const SCRIPTS_DIR = dirname(new URL(import.meta.url).pathname)
const PROJECT_ROOT = join(SCRIPTS_DIR, '..')
const REPO_DIR = join(SCRIPTS_DIR, '.~repo')
const REPO_URL = 'git@github.com:Stream44/FramespaceGenesis.git'
const IMAGE_NAME = 'framespace-genesis-test'

const args = process.argv.slice(2)
const shellMode = args.includes('--shell')
const noCache = args.includes('--no-cache')
const skipClone = args.includes('--skip-clone')

async function main() {
    // Step 1: Clone or update repo
    if (!skipClone) {
        console.log('\n Cloning repository...')
        if (existsSync(REPO_DIR)) {
            await rm(REPO_DIR, { recursive: true })
        }
        await mkdir(REPO_DIR, { recursive: true })
        const cloneProc = Bun.spawn(['git', 'clone', '--depth', '1', REPO_URL, REPO_DIR], { stdio: ['inherit', 'inherit', 'inherit'] })
        const cloneExit = await cloneProc.exited
        if (cloneExit !== 0) {
            console.error('Git clone failed')
            process.exit(1)
        }
    } else {
        if (!existsSync(REPO_DIR)) {
            console.error(' No .~repo directory found. Run without --skip-clone first.')
            process.exit(1)
        }
        console.log('\n Skipping clone, using existing .~repo/')
    }

    // Step 2: Copy Dockerfile into the cloned repo
    console.log('\n Copying Dockerfile into cloned repo...')
    await cp(join(PROJECT_ROOT, 'Dockerfile'), join(REPO_DIR, 'Dockerfile'))

    // Step 3: Build Docker image
    console.log('\nBuilding Docker image...')
    const buildArgs = ['docker', 'build', '-t', IMAGE_NAME]
    if (noCache) buildArgs.push('--no-cache')
    buildArgs.push(REPO_DIR)

    const buildProc = Bun.spawn(buildArgs, { stdio: ['inherit', 'inherit', 'inherit'] })
    const buildExit = await buildProc.exited
    if (buildExit !== 0) {
        console.error('Docker build failed')
        process.exit(1)
    }

    // Step 4: Run
    if (shellMode) {
        console.log('\nDropping into shell inside container...')
        console.log('  Useful commands:')
        console.log('    bun test --bail                    # run all tests')
        console.log('    bun test L4-space-models           # run specific tests')
        console.log('    ls node_modules/@stream44.studio/  # inspect installed packages')
        console.log('    find . -name "*.csts.json"         # find generated CST files')
        console.log('')
        const shellProc = Bun.spawn(['docker', 'run', '--rm', '-it', IMAGE_NAME, '/bin/bash'], { stdio: ['inherit', 'inherit', 'inherit'] })
        await shellProc.exited
    } else {
        console.log('\nRunning tests in container...')
        const testProc = Bun.spawn(['docker', 'run', '--rm', IMAGE_NAME], { stdio: ['inherit', 'inherit', 'inherit'] })
        const testExit = await testProc.exited
        if (testExit !== 0) {
            console.error(`\nTests failed with exit code ${testExit}`)
            process.exit(1)
        } else {
            console.log('\nAll tests passed!')
        }
    }
}

main().catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
})
