*** Settings ***
Documentation     Same-origin topology regression against the integrated frontend and real backend. Initial failure evidence is preserved in the October 25 Robot report.
Library           AegisApi.py    ${API_URL}
Test Setup        Start Fresh Owner
Test Teardown     Close Test Client
Test Timeout      60 seconds

*** Variables ***
${API_URL}        http://127.0.0.1:8000

*** Test Cases ***
Authenticated Budget Collection Reaches Its Data Through The Frontend
    Frontend Budget Collection Round Trip Stays On Origin
