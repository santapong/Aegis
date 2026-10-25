*** Settings ***
Documentation     Real HTTP/PostgreSQL acceptance. All identities and amounts are fictional.
Library           AegisApi.py    ${API_URL}
Test Setup        Start Fresh Owner
Test Teardown     Close Test Client
Test Timeout      60 seconds

*** Variables ***
${API_URL}        http://127.0.0.1:8000

*** Test Cases ***
The Acceptance Target Uses Real PostgreSQL
    Verify Real PostgreSQL Target

Anonymous Requests Cannot Read Financial Data
    Protected Routes Require Authentication

The Browser Session Cookie Lasts Twenty Four Hours
    Web Session Cookie Lasts A Day

Setup QR Is Local Private And Valid For A Day
    Setup Is Private Local QR And Twenty Four Hours

An Owner Can Finish Setup After Twenty Hours
    Setup Still Links After Twenty Hours

An Unused Setup Code Expires At Twenty Four Hours
    Setup Expires At Twenty Four Hours

Renewal Replaces An Unexpired Setup Code
    Renewal Rejects The Previous Setup Code

A Consumed Code Cannot Connect Another Actor
    Consumed Setup Cannot Bind Another Actor

An Established LINE Link Survives A Week
    LINE Identity Survives Seven Days

Bad Signatures And Group Chats Cannot Link
    Invalid Signatures And Group Chat Cannot Link

A Text Preview Leaves The Balance Unchanged
    Preview Does Not Post Money

Repeated Confirmation Records Exactly One Expense
    Duplicate Confirmation Has One Financial Effect

Budget Spending Remaining And Refunds Use Exact Satang
    Budget And Refund Arithmetic Is Exact

Unknown Currency Cannot Produce A Remaining Limit
    Unreviewed Currency Has No Remaining Cap

Changing A Budget Invalidates An Old Review
    Stale Budget Review Is Rejected

English Thai And Rich Menu Shortcuts Are Read Only
    Shortcuts Do Not Create Jobs Or Journals

Disconnecting Retires Existing Confirmation Buttons
    Disconnect Retires Pending Confirmation

Web Logout Preserves The LINE Identity Link
    Web Logout Does Not Disconnect LINE

Owners Cannot Review Each Others Limits
    One Owner Cannot Review Another Owners Budget

Prepare A Disposable Account For Visible Browser Acceptance
    Keep Fictional Browser Fixture
