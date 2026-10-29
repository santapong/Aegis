"""Read-only Robot UX journeys against a public Aegis deployment.
All non-read network methods are blocked; demo changes are browser-local.
"""
import json, os, re
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from robot.api.deco import library, keyword
from playwright.sync_api import sync_playwright, expect

@library(scope="SUITE", auto_keywords=False)
class AegisUX:
    def __init__(self, origin, evidence):
        self.origin=origin.rstrip("/")
        if urlparse(self.origin).scheme not in ("http","https"):
            raise ValueError("Expected an explicit web origin")
        self.evidence=Path(evidence);self.evidence.mkdir(parents=True,exist_ok=True)
        self.requests=0;self.errors=[];self.blocked=[];self.number=0
        self.observations=[]

    @keyword
    def start_ux_browser(self):
        self.driver=sync_playwright().start()
        self.browser=self.driver.chromium.launch(headless=True,executable_path=os.environ["AEGIS_UX_CHROMIUM"])
        self.context=self.browser.new_context(viewport={"width":1440,"height":1000},reduced_motion="reduce",service_workers="block")
        self.context.route("**/*",self._guard)
        self.page=self.context.new_page()
        self.page.set_default_timeout(7000);self.page.set_default_navigation_timeout(15000)
        self.page.on("pageerror",lambda error:self.errors.append(str(error)))

    def _guard(self,route):
        request=route.request;self.requests+=1
        if request.method not in ("GET","HEAD","OPTIONS"):
            self.blocked.append({"method":request.method,"path":urlparse(request.url).path})
            route.abort("blockedbyclient");return
        if self.requests>1800:
            route.abort("blockedbyclient");return
        route.continue_()

    @keyword
    def begin_ux_case(self):
        self.errors=[];self.blocked=[]

    def _goto(self,path,width=1440):
        self.page.set_viewport_size({"width":int(width),"height":1000})
        self.page.goto(self.origin+path,wait_until="domcontentloaded")
        expect(self.page.locator("main").first).to_be_visible()
        toggles=self.page.locator(".aegis-theme-toggle:visible")
        if toggles.count():expect(toggles.first).to_be_enabled()
        self.page.evaluate("document.fonts.ready")

    def _text(self,value):
        expect(self.page.locator("main").first).to_contain_text(value)

    def _theme(self,dark):
        control=self.page.locator(".aegis-theme-toggle:visible").first
        expect(control).to_be_enabled()
        if (control.get_attribute("aria-pressed")=="true")!=dark:control.click()
        name="horizon-dark" if dark else "horizon"
        self.page.wait_for_function("t=>document.body.classList.contains('theme-'+t)",arg=name)
        expected="rgb(220, 233, 175)" if dark else "rgb(18, 61, 50)"
        self.page.wait_for_function("c=>getComputedStyle(document.querySelector('.aegis-brand')).color===c",arg=expected)

    def _fits(self):
        dimensions=self.page.evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth})")
        assert dimensions["scroll"]<=dimensions["width"]+1,dimensions

    @keyword
    def main_identity_and_actions_are_clear(self):
        self._goto("/landing")
        expect(self.page.get_by_role("heading",level=1)).to_contain_text("A clearer today.")
        expect(self.page.get_by_role("heading",level=1)).to_contain_text("A bigger")
        assert self.page.locator('[data-aegis-mark="union"]').count()>=2
        assert self.page.get_by_role("link",name="Start planning",exact=True).first.get_attribute("href")=="/register"
        assert self.page.get_by_role("link",name="Sign in",exact=True).first.get_attribute("href")=="/login"
        self._text("Open source");self._fits()

    @keyword
    def personal_preview_explains_delayed_income(self):
        self._goto("/landing")
        self._text("฿43,900")
        self.page.get_by_label("What if income arrives next month?",exact=True).check()
        self._text("฿35,900")
        self.page.get_by_text("See the numbers behind the plan",exact=True).click()
        self._text("Recorded")

    @keyword
    def business_demo_preserves_landing_intent(self):
        self._goto("/landing")
        link=self.page.locator('a[href="/demo?story=business"]')
        expect(link).to_be_visible();link.click()
        expect(self.page.locator("#story-title")).to_have_text("Business X")
        self._text("฿88,000")
        self.page.get_by_label("Payment arrives next month",exact=True).check()
        self._text("Uncovered in this plan");self._text("฿2,000")
        self._text("commitments and reserve goal")
        self._fits()

    @keyword
    def mobile_navigation_escape_restores_focus(self):
        self._goto("/landing",320)
        button=self.page.get_by_role("button",name="Open navigation",exact=True)
        button.click()
        expect(self.page.get_by_role("navigation",name="Mobile navigation")).to_be_visible()
        self.page.keyboard.press("Escape")
        expect(button).to_be_focused()
        expect(button).to_have_attribute("aria-expanded","false")
        self._fits()

    @keyword
    def keyboard_skip_link_reaches_content(self):
        self._goto("/landing")
        self.page.keyboard.press("Tab")
        expect(self.page.get_by_role("link",name="Skip to content",exact=True)).to_be_focused()
        self.page.keyboard.press("Enter");self.page.keyboard.press("Tab")
        assert self.page.evaluate("!!document.activeElement.closest('main')"),"Keyboard focus did not enter the main content"

    @keyword
    def topic_search_understands_task_words(self):
        self._goto("/docs")
        search=self.page.get_by_role("searchbox",name="Filter topics",exact=True)
        for query in ["import csv", "  CSV   import  ", "review csv"]:
            search.fill(query)
            expect(self.page.locator('#topics a[href="/docs/guides/transactions"]')).to_be_visible()
        self.page.get_by_role("button",name="Everyday money",exact=True).click()
        expect(self.page.locator('#topics a[href="/docs/guides/transactions"]')).to_be_visible()
        self.page.get_by_role("button",name="Your data & control",exact=True).click()
        self._text("No topics match that combination.")
        self.page.get_by_role("button",name="All topics",exact=True).click()
        expect(self.page.locator('#topics a[href="/docs/guides/transactions"]')).to_be_visible()

    @keyword
    def documentation_empty_search_has_recovery(self):
        self._goto("/docs",320)
        search=self.page.get_by_role("searchbox",name="Filter topics",exact=True)
        search.fill("no-such-topic-ux-20261029")
        self._text("No topics match that combination.")
        self.page.get_by_role("button",name="Show all topics",exact=True).click()
        expect(search).to_have_value("")
        expect(self.page.locator('#topics a[href="/docs/guides/transactions"]')).to_be_visible()
        self._fits()

    @keyword
    def header_search_finds_section_words(self):
        self._goto("/docs/guides/transactions")
        self.page.get_by_role("searchbox",name="Search documentation",exact=True).fill("review csv")
        expect(self.page.locator('#docs-search-results a[href="/docs/guides/transactions"]')).to_be_visible()

    @keyword
    def login_keeps_inputs_during_theme_change(self):
        self._goto("/login",320)
        email=self.page.get_by_label("Email address",exact=True)
        email.fill("ux-audit@example.invalid")
        self._theme(True)
        expect(email).to_have_value("ux-audit@example.invalid")
        password=self.page.locator('input[autocomplete="current-password"]')
        expect(password).to_have_attribute("type","password")
        password.fill("Synthetic-test-only-20261029")
        self.page.get_by_role("button",name="Show password",exact=True).click()
        expect(password).to_have_attribute("type","text")
        self._theme(False)
        expect(email).to_have_value("ux-audit@example.invalid");self._fits()

    @keyword
    def signup_mismatch_is_explained_before_any_request(self):
        self._goto("/register",320)
        self.page.locator("#register-name").fill("UX audit")
        self.page.locator("#register-email").fill("ux-audit@example.invalid")
        self.page.locator("#register-password").fill("Synthetic-test-only-20261029")
        self.page.locator("#register-confirm").fill("Different-test-only-20261029")
        self.page.get_by_role("button",name="Create account",exact=True).click()
        error=self.page.locator('[role="alert"][tabindex="-1"]')
        expect(error).to_contain_text("don’t match")
        expect(error).to_be_focused()
        assert not self.blocked,"A signup request was attempted despite a client mismatch"
        self._fits()

    @keyword
    def protected_links_keep_the_sign_in_destination(self):
        for path in ["/cashflow","/accounts","/settings"]:
            self._goto(path)
            self.page.wait_for_url("**/login?next=**")
            assert parse_qs(urlparse(self.page.url).query).get("next")==[path],self.page.url

    @keyword
    def demo_expense_and_theme_keep_the_same_story(self):
        self._goto("/demo",320)
        expect(self.page.locator("#story-title")).to_have_text("A personal month")
        self.page.get_by_role("button",name="Add sample expense",exact=True).click()
        self.page.get_by_label("Description",exact=True).fill("Coffee with a friend")
        self.page.get_by_label("Amount (THB)",exact=True).fill("125")
        self.page.get_by_role("button",name="Add to example",exact=True).click()
        self._text("฿43,775")
        self._theme(True);self._text("฿43,775")
        self.page.get_by_role("button",name="Reset this story",exact=True).click()
        self._text("฿43,900");self._theme(False);self._fits()

    @keyword
    def public_layouts_work_in_both_modes(self):
        for path in ["/landing","/docs","/login","/register"]:
            self._goto(path,320)
            for dark in [False,True]:
                self._theme(dark);self._fits()
        self._theme(False)

    @keyword
    def save_ux_evidence(self,name,status):
        self.number+=1
        slug=re.sub("[^a-z0-9]+","-",name.lower()).strip("-")[:65]
        image=self.evidence/f"{self.number:02}-{slug}-{status.lower()}.png"
        self.page.screenshot(path=str(image))
        self.observations.append({"case":name,"status":status,"url":self.page.url,"image":image.name,
          "width":self.page.viewport_size["width"],"page_errors":self.errors.copy(),"blocked_writes":self.blocked.copy(),"request_count":self.requests})
        (self.evidence.parent/"browser-observations.json").write_text(json.dumps(self.observations,indent=2))
        assert not self.errors,self.errors
        assert not self.blocked,self.blocked
        assert self.requests<=1800,"Browser request budget exceeded"

    @keyword
    def stop_ux_browser(self):
        if hasattr(self,"context"):self.context.close()
        if hasattr(self,"browser"):self.browser.close()
        if hasattr(self,"driver"):self.driver.stop()
