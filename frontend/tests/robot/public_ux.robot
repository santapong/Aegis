*** Settings ***
Documentation     Public Aegis UX acceptance. Real browser interactions, read-only network guard, fictional demo only. Does not qualify real sign-in or financial persistence.
Library           AegisUX.py    ${ORIGIN}    ${EVIDENCE}
Suite Setup       Start UX Browser
Suite Teardown    Stop UX Browser
Test Setup        Begin UX Case
Test Teardown     Save UX Evidence    ${TEST NAME}    ${TEST STATUS}
Test Timeout      60 seconds

*** Variables ***
${ORIGIN}         https://aegis-eight-azure.vercel.app
${EVIDENCE}       screenshots

*** Test Cases ***
Main Identity And Next Actions Are Clear
    Main Identity And Actions Are Clear

Personal Preview Explains Delayed Income
    Personal Preview Explains Delayed Income

Business Link Preserves The Visitor's Intent
    Business Demo Preserves Landing Intent

Mobile Navigation Escape Restores Focus
    Mobile Navigation Escape Restores Focus

Keyboard Skip Link Reaches Content
    Keyboard Skip Link Reaches Content

Topic Search Understands Multiword Tasks
    Topic Search Understands Task Words

Empty Topic Search Has A Clear Recovery
    Documentation Empty Search Has Recovery

Guide Search Finds Section Words
    Header Search Finds Section Words

Login Preserves Inputs And Password Visibility
    Login Keeps Inputs During Theme Change

Signup Mismatch Is Explained Before A Request
    Signup Mismatch Is Explained Before Any Request

Protected Links Retain Their Destination
    Protected Links Keep The Sign In Destination

Demo Changes Survive Appearance Changes
    Demo Expense And Theme Keep The Same Story

Phone Layouts Work In Both Appearances
    Public Layouts Work In Both Modes
