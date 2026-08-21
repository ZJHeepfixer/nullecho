/**
 * Nullecho — DROP onboarding
 * ───────────────────────
 * Guides a California resident to the state's Delete Request and Opt-Out Platform.
 *
 * Two rules govern this file, both non-negotiable (see docs/DECISIONS.md D5, D7):
 *
 *   1. We NEVER automate a submission or fill the state's forms. DROP verifies the
 *      consumer's identity through the California Identity Gateway. Scripting that
 *      could invalidate the user's request or amount to misrepresentation. We link
 *      out and stop. Every outbound link below is a plain anchor in drop.html.
 *
 *   2. We NEVER collect, transmit or store personal information. The only thing
 *      written to storage is a date the user typed, plus their answer to the
 *      residency question. No name, no DOB, no ZIP, and deliberately NOT the
 *      8-digit DROP ID — that is a credential for their deletion record and a
 *      privacy tool has no business holding one.
 *
 * The broker registry is a build-time snapshot of CalPrivacy's machine-readable CSV
 * (https://cppa.ca.gov/data_broker_registry/registry.csv), embedded so that browsing
 * it makes no network request and leaks nothing about the user.
 */

'use strict';

/* ── Verified constants ──────────────────────────────────────────────────
   Each of these was confirmed against the cited source on 2026-08-20.
   Do not edit without re-verifying — this page makes legal claims.        */

const SOURCES = Object.freeze({
  portal:   'https://consumer.drop.privacy.ca.gov',
  status:   'https://consumer.drop.privacy.ca.gov/dropstatus',
  info:     'https://privacy.ca.gov/drop/',
  howItWorks: 'https://privacy.ca.gov/drop/how-drop-works/',
  registry: 'https://cppa.ca.gov/data_broker_registry/',
  registryCsv: 'https://cppa.ca.gov/data_broker_registry/registry.csv'
});

/** Date data brokers became legally required to begin processing DROP requests.
 *  Source: privacy.ca.gov/drop — "Starting August 1, 2026, data brokers must
 *  access DROP at least once every 45 days to begin processing deletion requests." */
const BROKER_PROCESSING_START = '2026-08-01';

/** Days a broker has to report how it processed a request.
 *  Source: privacy.ca.gov/drop/how-drop-works/ — "Data brokers have up to 90 days
 *  to report how they processed your request." */
const REPORT_WINDOW_DAYS = 90;

/** Ongoing re-check cadence. Source: same page — "After initial processing, data
 *  brokers must re-check and delete new matching data at least every 45 days.
 *  DROP is ongoing – not a one-time action." */
const RECHECK_DAYS = 45;

/** How often we suggest revisiting your own profile. This is OUR suggestion, not a
 *  legal requirement, and the UI says so. DROP requests do not expire. */
const PROFILE_REVIEW_DAYS = 180;

/** Date the bundled registry snapshot was taken from the CSV above. */
const SNAPSHOT_DATE = '2026-08-20';

/* Registry field flags, as recorded by the brokers themselves in their CalPrivacy
   registration. Column headings are quoted from the CSV. */
const FLAG_META = Object.freeze({
  g: { label: 'Precise location', hot: false, title: "Collects consumers' precise geolocation" },
  m: { label: "Minors' data",     hot: true,  title: 'Collects personal information of minors' },
  b: { label: 'Biometrics',       hot: true,  title: "Collects consumers' biometric data" },
  r: { label: 'Reproductive health', hot: true, title: "Collects consumers' reproductive health care data" },
  A: { label: '→ GenAI',          hot: true,  title: 'Shared or sold data to a developer of a GenAI system or model in the past year' },
  F: { label: '→ Federal gov',    hot: true,  title: 'Shared or sold data to the federal government in the past year' },
  L: { label: '→ Law enforcement', hot: true, title: 'Shared or sold data to law enforcement in the past year, except when required by subpoena or court order' },
  C: { label: 'FCRA',             hot: false, title: 'The data broker or a subsidiary is regulated by the federal Fair Credit Reporting Act' }
});

const STORAGE_KEYS = Object.freeze({
  residency: 'nullecho.drop.residency',
  submitted: 'nullecho.drop.submittedAt'
});

/* ── Registry snapshot (generated — do not hand-edit) ─────────────────── */
const REGISTRY_JSON = '[{"n":"01Advertising Inc.","w":"01advertising.com","f":"g"},{"n":"33 Mile Radius LLC","w":"33mileradius.com"},{"n":"33Across, Inc.","w":"33across.com"},{"n":"5x5 US, LLC","w":"5x5data.com","f":"g"},{"n":"6sense Insights, Inc.","w":"6sense.com"},{"n":"A Direct Marketing Inc","w":"bookyourdata.com","d":"Bookyourdata"},{"n":"Above Data, Inc.","w":"abovedata.io","d":"Above Data"},{"n":"Accudata Integrated Marketing, LLC","w":"acculeads.com; https:"},{"n":"Accurate Append Inc.","w":"accurateappend.com"},{"n":"ACH, Address Clearing House","w":"achcoop.com"},{"n":"Acronymix LLC","w":"acronymix.com","f":"g"},{"n":"ActivImpact, LLC","w":"activimpact.ai","d":"ActivImpact"},{"n":"Acxiom LLC","w":"acxiom.com","f":"mgF"},{"n":"Addapptation, Inc.","w":"propensity.com","d":"Propensity"},{"n":"AdeptID, Inc.","w":"adept-id.com"},{"n":"Adprime Media LLC","w":"adprime.com","d":"Adprime"},{"n":"adsquare GmbH","w":"adsquare.com","f":"g"},{"n":"Adstra LLC","w":"adstradata.com"},{"n":"AdsWizz, Inc.","w":"adswizz.com"},{"n":"Adttribution Inc","w":"adttribution.com","d":"Adttribution","f":"g"},{"n":"AdvisorTarget, LLC","w":"finsum.com","d":"FinSum"},{"n":"Affinity Answers Corporation","w":"affinityanswers.com"},{"n":"Affinity Solutions Inc.","w":"affinity.solutions"},{"n":"AggKnowledge Inc.","w":"aggknowledge.ai"},{"n":"Agile Education Marketing, LLC","w":"agile-ed.com","f":"F"},{"n":"AGR Marketing Solutions LLC","w":"agrmarketingsolutions.com"},{"n":"Aidentified, Inc.","w":"aidentified.com"},{"n":"Airlines Reporting Corporation","w":"arccorp.com","f":"mFL"},{"n":"AlikeAudience Inc","w":"alikeaudience.com","d":"AlikeAudience"},{"n":"Allant Group, LLC","w":"allantgroup.com"},{"n":"Alliant Cooperative Data Solutions LLC","w":"alliantinsight.com","f":"C"},{"n":"Alphonso Inc.","w":"alphonso.tv"},{"n":"Altair Data Resources, Inc","w":"altairdata.com","f":"C"},{"n":"Altrata, Inc.","w":"altrata.com"},{"n":"AnalyticsIQ Inc","w":"analytics-iq.com"},{"n":"Anchor Computer Inc.","w":"anchorcomputer.com"},{"n":"Aniline, Inc.","w":"aniline.ai; www.salesassistiq.ai","d":"SalesAssistIQ"},{"n":"Anne Lewis Strategies LLC","w":"missionwired.com","d":"MissionWired"},{"n":"Anteriad, LLC","w":"anteriad.com"},{"n":"Apollo Interactive, LLC","w":"apollointeractive.com; http:","d":"Mortgage Rates Pro; Online Mortgage Loans; Best Auto Insurance; BlueSky Coverage; National Auto Quotes; National Home Quotes; Final Expense Quotes; Great Life Insurance; Life Insurance Pro; Affordable Health Quotes; Affordable Health Insurance; Health Insurance Online; Health Plans of America; Medicare Coverage Finder; Medicare Info; Medicare Providers"},{"n":"App Science, Inc","w":"appscience.ai"},{"n":"AppLovin Corporation","w":"applovin.com"},{"n":"Aristotle International, Inc.","w":"aristotle.com"},{"n":"ASL Marketing","w":"deepsync.com"},{"n":"Asset International, Inc.","w":"issmarketintelligence.com","f":"F"},{"n":"Astoria Company","w":"astoriacompany.com"},{"n":"AtData, LLC","w":"atdata.com"},{"n":"Attribits","w":"attribits.com"},{"n":"Audience Acuity LLC","w":"audienceacuity.com","d":"Audience Acuity"},{"n":"Audience Mix LLC","w":"audiencemix.net","d":"AudienceMix","f":"g"},{"n":"Austin Consolidated Holdings, Inc.","w":"equifax.com"},{"n":"Autodata Solutions, Inc.","w":"jdpower.com"},{"n":"AutoWeb, Inc.","w":"autoweb.com","f":"gC"},{"n":"AWL Holdings, LLC","w":"allwebleads.com; insurancequotes.com; usinsuranceonline.com; affordable-home-insurance.org; discount-car-insurance-rates.com; general-liability-insurance-rates.com; affordable-health-insurance-plans.org; affordable-life-insurance-rates.org"},{"n":"Azerion US Inc.","w":"azerion.com","f":"gr"},{"n":"Azira, LLC","w":"azira.com","d":"Azira. LLC","f":"g"},{"n":"Babel Street, Inc.","w":"babelstreet.com","f":"gFL"},{"n":"Bachmanity, Inc.","w":"aviato.co","d":"Aviato","f":"g"},{"n":"Baron App, Inc.","w":"candl.app; cameo.com"},{"n":"BB Direct Inc","w":"bbdirect.com","f":"C"},{"n":"BDEX, LLC","w":"bdex.com"},{"n":"BDO GCI, LLC","w":"bdo.com","f":"m"},{"n":"BECAUSAL, INC.","w":"becausal.com","f":"g"},{"n":"BeenVerified, LLC and its subsidiaries and affiliates","w":"beenverified.com; https:"},{"n":"Beeswax","w":"beeswax.com","f":"g"},{"n":"Belardi Ostroy, ALC, LLC","w":"belardiwong.com"},{"n":"Best Pick Reports, LLC","w":"bestpickreports.com"},{"n":"BH Marketing Group LLC","w":"usmarketinggrp.com","d":"Us marketing Group"},{"n":"BIGDBM","w":"bigdbm.com; https:","d":"PublicNSA LLC dba BIGDBM"},{"n":"Biointelli Corporation","w":"biointelli.com","d":"Biointelli"},{"n":"Biscred","w":"biscred.com"},{"n":"Black Pearl Group Limited","w":"blackpearl.com"},{"n":"Blackbaud, Inc","w":"blackbaud.com"},{"n":"Blis Global Ltd","w":"blis.com","f":"g"},{"n":"Blue Action Inc.","w":"blueaction.io"},{"n":"Blue Hill Marketing Solutions, Inc","w":"liftbasedata.com; www.liftengine.com; www.launchpadltv.com","d":"LiftEngine"},{"n":"Blueprint Audiences","w":"blueprintaudiences.com"},{"n":"Bombora, Inc.","w":"bombora.com"},{"n":"Bridg, a division of Cardlytics, Inc.","w":"bridg.com"},{"n":"Brooks Integrated Marketing, LLC","w":"brooksim.com"},{"n":"Buildertrend Solutions, Inc.","w":"buildertrend.com; https:"},{"n":"Bushwick Growbots LLC","w":"growbots.com"},{"n":"Buxton Company, LLC","w":"buxtonco.com","f":"g"},{"n":"Buyerlink Inc.","w":"buyerlink.co","f":"gC"},{"n":"BuyersRoad, Inc","w":"experience.com","d":"Experience.com"},{"n":"BV Insights LLC","w":"big-village.com","f":"mA"},{"n":"Cadent LLC","w":"cadent.tv","f":"g"},{"n":"Captify Technologies","w":"captifytechnologies.com"},{"n":"Captiv8 Inc.","w":"captiv8.io"},{"n":"Carry Technologies Inc.","w":"hightouch.com","d":"Hightouch"},{"n":"Catalina Marketing Corporation","w":"catalina.com","d":"Catalina Marketing","f":"g"},{"n":"Catalist LLC","w":"catalist.us"},{"n":"CB Information Services, Inc.","w":"cbinsights.com","d":"CB Insights"},{"n":"CDK Global, LLC","w":"cdkglobal.com","d":"CDK"},{"n":"Censia, Inc.","w":"censia.com","d":"Censia"},{"n":"Chartboost, LLC","w":"loopme.com","d":"Chartboost; LoopMe"},{"n":"CHECKPEOPLE, LLC","w":"checkpeople.com","f":"g"},{"n":"Choreograph LLC","w":"choreograph.com","f":"gr"},{"n":"Circana, LLC","w":"circana.com"},{"n":"Cision","w":"cision.com","f":"F"},{"n":"CITYDATA Inc.","w":"citydata.ai","d":"CityData.AI","f":"g"},{"n":"Civil Data Research, LLC","w":"searchpublicrecords.com","d":"searchpublicrecords.com","f":"bg"},{"n":"Civis Analytics, Inc.","w":"civisanalytics.com"},{"n":"Claritas LLC","w":"claritas.com"},{"n":"Clarivate","w":"clarivate.com","f":"F"},{"n":"Clay Labs, Inc.","w":"clay.com","f":"A"},{"n":"ClearCompany, LLC","w":"clearcompany.com","d":"ClearCo","f":"C"},{"n":"Clearview AI, Inc.","w":"clearview.ai","f":"bFL"},{"n":"Clickagy LLC","w":"clickagy.com","d":"Clickagy"},{"n":"Coast Technology, LLC","w":"coasttechnology.com","f":"g"},{"n":"Cognism","w":"cognism.com"},{"n":"Collective Data Solutions, LLC","w":"collectivedata.io","f":"g"},{"n":"Command Precision Inc.","w":"persistent.id","d":"Persistent.id"},{"n":"Commerce Signals, Inc.","w":"commercesignals.com"},{"n":"Compact Information Systems, LLC","w":"deepsync.com","d":"Deep Sync"},{"n":"Complete Mailing Lists LLC","w":"completemailinglists.com"},{"n":"Complete Medical Lists, Inc.","w":"completemedicallists.com"},{"n":"Comscore, Inc","w":"comscore.com","d":"Comscore Inc","f":"m"},{"n":"Connatix Native Exchange Inc.","w":"jwx.com"},{"n":"Connected Investors, LLC","w":"connectedinvestors.com"},{"n":"Connection Holdings","w":"connectionholdings.com","d":"Solar Direct Marketing"},{"n":"Consumer Canvas, LLC","w":"consumercanvas.net","d":"No","f":"r"},{"n":"Consumerbase, LLC","w":"exactdata.com","d":"Exact Data","f":"mA"},{"n":"ContactOut Limited","w":"contactout.com"},{"n":"Converge Marketing LLC","w":"convergemarketing.com"},{"n":"Convex Labs LLC","w":"convex.com"},{"n":"CoStar Realty Information, Inc.","w":"costar.com","f":"gF"},{"n":"Cox Automotive, Inc.","w":"coxautoinc.com; www.autotrader.com; www.fordblueadvantage.com; www.kbb.com","f":"bg"},{"n":"Crimson Hexagon","w":"brandwatch.com","d":"Brandwatch","f":"FLA"},{"n":"Crisil Irvena US LLC","w":"greenwich.com"},{"n":"Criteo Corp.","w":"criteo.com"},{"n":"Cross Pixel Media, Inc.","w":"crosspixel.net"},{"n":"Crunchbase, Inc.","w":"crunchbase.com","d":"Crunchbase","f":"FLA"},{"n":"CTAM LeadShare Corp.","w":"smartmove.us"},{"n":"Cuebiq Group, LLC","w":"cuebiq.com","f":"g"},{"n":"Cybba Inc.","w":"cybba.com","f":"g"},{"n":"Data Axle Inc.","w":"data-axle.com","d":"Data Axle","f":"mA"},{"n":"Data Decisions Group","w":"datadecisionsgroup.com"},{"n":"Data Partners, Inc.","w":"datapartners.com","d":"DataPartners"},{"n":"DataDelivers, LLC","w":"datadelivers.com","f":"g"},{"n":"Datadesk Inc.","w":"datadesk.io","d":"Datadesk"},{"n":"Datafy, LLC","w":"datafy.com","f":"g"},{"n":"Dataline, Inc.","w":"datalinedata.com"},{"n":"Datalink Services, Inc","w":"transunion.com","f":"C"},{"n":"Dataman Group Inc","w":"datamangroup.com"},{"n":"Datamentors LLC","w":"porchgroupmedia.com","d":"PGM Solutions; Porch Group Media"},{"n":"Datanyze LLC","w":"datanyze.com","d":"Datanyze"},{"n":"Datasys Group, Inc.","w":"datasys.com","d":"Datasys"},{"n":"Date Detective Inc","w":"date-detective.app; https:","d":"Date Detective"},{"n":"Datonics LLC","w":"datonics.com"},{"n":"DealerDirect LLC","w":"forddirect.com","d":"FordDirect"},{"n":"DealerSocket, LLC (US)","w":"dealersocket.com"},{"n":"DealerX Partners LLC","w":"dealerx.com"},{"n":"Dealfront Finland Oy","w":"leadfeeder.com"},{"n":"Dealfront Group GmbH","w":"leadfeeder.com"},{"n":"DealMachine Operations Inc.","w":"dealmachine.com","d":"DealMachine"},{"n":"Decide Technologies Inc.","w":"decide.co","d":"Decide","f":"g"},{"n":"DecisionLinks LLC","w":"decisionlinks.com","d":"DecisionLinks","f":"C"},{"n":"Deep Root Analytics, LLC","w":"deeprootanalytics.com"},{"n":"Definitive Healthcare LLC","w":"definitivehc.com","d":"NA","f":"F"},{"n":"Deloitte Consulting LLP","w":"deloitte.com; https:","f":"F"},{"n":"Deloitte Financial Advisory Services LLP","w":"deloitte.com"},{"n":"Demand Science US, LLC","w":"demandscience.com","d":"Demand Science"},{"n":"Demandbase, Inc.","w":"demandbase.com"},{"n":"Dice Career Solutions, Inc.","w":"dice.com","d":"Dice.com"},{"n":"Digital Media Solutions, LLC","w":"digitalmediasolutions.com"},{"n":"Digital Safety Products, LLC","w":"spyfly.com; publicrecordreports.com","d":"spyfly.com, publicrecordreports.com","f":"bg"},{"n":"Digital Viking Media Inc","w":"digitalvikingmedia.com","f":"g"},{"n":"Disco Technology Inc","w":"disconetwork.com"},{"n":"Disqus","w":"disqus.com","f":"g"},{"n":"DonorBase, Inc.","w":"donorbase.com","d":"DonorBase"},{"n":"DonorBureau LLC","w":"donorbureau.com","d":"DonorBureau"},{"n":"DR Decision Resources, LLC","w":"clarivate.com","f":"F"},{"n":"Draup, Inc.","w":"draup.com"},{"n":"Dresden Direct inc.","w":"dresdendirect.com"},{"n":"Drivers History Information Sales, LLC","w":"transunion.com","f":"C"},{"n":"DSPolitical, LLC","w":"dspolitical.com"},{"n":"Dstillery, Inc.","w":"dstillery.com"},{"n":"DT Client Services, LLC","w":"thedatatrust.com","d":"Data Trust"},{"n":"DTN, LLC","w":"dtn.com","f":"gFL"},{"n":"Dun and Bradstreet Inc.","w":"dnb.com","f":"FLA"},{"n":"e.Republic, LLC","w":"erepublic.com; govtech.com; governing.com; marketing.governmentnavigator.com; insider.govtech.com"},{"n":"EAB Global, Inc.","w":"eab.com","f":"m"},{"n":"eContext.ai LLC","w":"complementics.com","d":"Complementics","f":"g"},{"n":"Edvisors Network, Inc.","w":"edvisors.com"},{"n":"Effyis, Inc.","w":"socialgist.ai","d":"Socialgist; Boardreader","f":"A"},{"n":"El Toro.com, LLC","w":"eltoro.com","f":"g"},{"n":"Electronic Voice Services, Inc.","w":"telephonelists.biz"},{"n":"Elevar, LLC","w":"getelevar.com","d":"Chris Holbert"},{"n":"eLocal USA, LLC","w":"elocal.com"},{"n":"Endgame Labs, Inc.","w":"endgame.io","d":"Endgame","f":"A"},{"n":"Enformion, LLC","w":"enformion.com; tracers.com; go.enformion.com","d":"Tracers.com; EnformionGO","f":"gFL"},{"n":"Enigma Technologies, Inc.","w":"enigma.com"},{"n":"Enlyft Inc.","w":"enlyft.com","d":"Enlyft"},{"n":"Epsilon Data Management, LLC","w":"epsilon.com","f":"r"},{"n":"Equifax Information Services LLC","w":"equifax.com","f":"mbFLAC"},{"n":"Equifax Workforce Solutions LLC","w":"theworknumber.com","f":"mbFLC"},{"n":"EquiMine Inc.","w":"batchleads.io","d":"BatchLeads"},{"n":"EverView HoldCo, Inc","w":"evertrue.com","d":"EverTrue; DonorSearch","f":"g"},{"n":"Evorra Ltd","w":"evorra.com","f":"F"},{"n":"Exa Labs Inc.","w":"exa.ai","d":"Exa"},{"n":"Exact Match Marketing Inc","w":"exactmatchmarketing.com; app.exactmatchmarketing.com; exactmatch.io"},{"n":"Exact Opco, LLC","w":"exactcustomer.com","d":"Exact Customer"},{"n":"eXelate, Inc.","w":"nielsen.com","d":"Nielsen Marketing Cloud"},{"n":"ExlService.com, LLC","w":"exlservice.com","d":"not applicable","f":"C"},{"n":"Experian Information Solutions, Inc","w":"experian.com","f":"FC"},{"n":"Experian Marketing Solutions, LLC","w":"experian.com","f":"mA"},{"n":"Explorium Inc.","w":"explorium.ai","d":"Explorium"},{"n":"Eyeota Pte Ltd","w":"eyeota.com","f":"A"},{"n":"Family Tree Now, LLC","w":"familytreenow.com"},{"n":"Famous Birthdays LLC","w":"famousbirthdays.com; https:","f":"m"},{"n":"Faraday, Inc.","w":"faraday.ai"},{"n":"Fetch Rewards, LLC","w":"fetch.com","f":"g"},{"n":"FI Navigator Corporation","w":"fi-navigator.com"},{"n":"Fideo Intelligence, Inc.","w":"fideo.ai","f":"F"},{"n":"Fifty Technology Ltd","w":"fifty.io","d":"Fifty; Fifty.io"},{"n":"Findem, Inc.","w":"findem.ai"},{"n":"FinThrive Healthcare, Inc.","w":"finthrive.com","d":"None"},{"n":"First Direct, Inc.","w":"firstdirectmarketing.com; nationallistcounts.com","d":"First Direct; National List Services; FirstDirect360"},{"n":"First Orion Corp","w":"firstorion.com"},{"n":"Focus USA, Inc.","w":"focus-usa.com","d":"Focus USA"},{"n":"Fog Data science LLC","w":"fogdatascience.com","f":"gFL"},{"n":"Foo Monk, LLC","w":"instantly.ai","d":"Instantly.ai"},{"n":"Forager.ai, LLC","w":"forager.ai"},{"n":"Four Corner Media Corp","w":"fourcornerhome.com; https:"},{"n":"Fourleaf LLC","w":"fourleafdata.com"},{"n":"Foursquare Labs, Inc.","w":"foursquare.com","f":"g"},{"n":"FourthWall Media, Inc.","w":"fourthwall.tv","d":"FourthWall","f":"g"},{"n":"Fraiser LLC","w":"fraiser.org"},{"n":"Free Data Services, LLC","w":"truepeoplesearch.com","d":"TruePeopleSearch.com"},{"n":"FREEPEOPLESEARCH.COM, LLC","w":"freepeoplesearch.com","f":"g"},{"n":"FreeWheel Media Inc","w":"freewheel.com","f":"g"},{"n":"Fushia Media, LLC","w":"fushiamedia.com"},{"n":"General Motors LLC","w":"gm.com","f":"g"},{"n":"GETEMAILS LLC","w":"retention.com; www.rb2b.com","d":"RETENTION.COM; RB2B"},{"n":"GetVector, Inc.","w":"vector.co","d":"Vector"},{"n":"Giant Partners, Inc.","w":"giantpartners.com; www.listgiant.com"},{"n":"Gigabite Inc","w":"boam.ai","d":"Boam AI"},{"n":"Global Source Data Solutions Inc","w":"gsdsi.com","f":"g"},{"n":"Globicom Inc","w":"recordsfinder.com; https:","d":"Records Finder Inc"},{"n":"Grassroots Analytics","w":"grassrootsanalytics.com"},{"n":"GrayHair Software LLC","w":"grayhairsoftware.com"},{"n":"Graze Social PBC","w":"graze.social"},{"n":"Great Lakes List, Inc.","w":"greatlakeslists.com","d":"Great Lakes List Management"},{"n":"Growing Libraries, LLC","w":"growinglibraries.com"},{"n":"GrowthCode, LLC","w":"growthcode.io"},{"n":"Guidestar Direct, Corp.","w":"carneydirect.com","d":"Carney Direct Marketing"},{"n":"H1 Insights, Inc.","w":"h1.co"},{"n":"Health Union, LLC","w":"health-union.com"},{"n":"Healthcare Inc","w":"healthcare.com; https:","d":"Healthcare.com","f":"g"},{"n":"HealthLink Dimensions","w":"healthlinkdimensions.com"},{"n":"HealthWise Data","w":"healthwisedata.com","f":"r"},{"n":"Heartbeat.AI Inc","w":"heartbeat.ai","d":"Heartbeat AI"},{"n":"Helix Campaigns LLC","w":"helixcampaigns.com"},{"n":"HireTeamMate, Inc.","w":"hireez.com","d":"hireEZ","f":"F"},{"n":"Hivestack Technologies Inc.","w":"perion.com","d":"Perion","f":"g"},{"n":"Home Contractors Review, LLC","w":"fivestarrated.com","d":"Five Star Rated"},{"n":"HubSpot, Inc.","w":"hubspot.com; https:"},{"n":"Huge Legal Technology Company, Inc","w":"trustandwill.com","d":"Trust & Will"},{"n":"Hunt Club Inc","w":"app.exploreatlas.io","d":"Atlas"},{"n":"Hunter Web Services, Inc","w":"hunter.io"},{"n":"i360, LLC","w":"i-360.com","f":"F"},{"n":"ID5 Technology Ltd","w":"id5.io","d":"ID5"},{"n":"IDMAP Inc","w":"idmap.ai","f":"g"},{"n":"iLeads.com, LLC","w":"ileads.com"},{"n":"illumin Inc.","w":"illumin.com"},{"n":"Inbound Insight, LLC","w":"inboundinsight.com","d":"Inbound Insight"},{"n":"Index Exchange Inc.","w":"indexexchange.com","f":"g"},{"n":"Infinite Media Concepts, Inc.","w":"mailinglists.com","d":"Mailinglists.com"},{"n":"Infomatics LLC","w":"privatereports.com; mugshotlook.com; publicsearcher.com"},{"n":"InfoPay, Inc","w":"infopay.com; infotracer.com; propertychecker.com; goodcar.com; statecourts.org; courtcasefinder.com; thepublicindex.org; entitycheck.com; sentinex.org; idstrong.com; courtrecords.us; staterecords.org; recordsfinder.com","d":"InfoTracer; GoodCar; Propertychecker; EntityCheck; Sentinex; Courtcasefinder; Statecourts; Thepublicindex; IDStrong; CourtRecords; StateRecords; RecordsFinder"},{"n":"Informa Group Limited","w":"informa.com"},{"n":"Information Data Resources, LLC","w":"publicinfoservices.com","d":"publicinfoservices.com","f":"bg"},{"n":"INFORMATION.COM, LLC","w":"information.com","f":"g"},{"n":"Inmar Brand Solutions, Inc.","w":"inmar.com"},{"n":"Inmar-OIQ, LLC","w":"inmar.com"},{"n":"InMarket Media, LLC","w":"inmarket.com","d":"InMarket","f":"g"},{"n":"Innovation Brands Corp","w":"proxima.ai","d":"Dojomojo"},{"n":"Innovative Database Solutions, Inc.","w":"idatabasesolutions.com"},{"n":"Insightbridge LLC","w":"mylife.com"},{"n":"Instant Checkmate LLC","w":"instantcheckmate.com; www.cellphonedirectory.com; www.cheaterslie.com; www.freepeople-search.com","d":"Instant Checkmate"},{"n":"Institutional Shareholder Services Inc.","w":"issgovernance.com","f":"F"},{"n":"Intalytics, Inc.","w":"intalytics.com","d":"Kalibrate"},{"n":"Integrated Direct Marketing, LLC","w":"idm.us.com","d":"IDM, LLC"},{"n":"Intelius, LLC","w":"intelius.com; www.ussearch.com; www.pro.ussearch.com; www.arrestrecordsearch.com; www.criminalrecords.com; www.peoplefinder.com; www.peoplefind.com; www.telephonenumberlookups.com; www.reversephonelookup.com; www.brbpub.com; www.callercomplaints.com; www.courtreference.com; www.easybackgroundchecks.com; www.freebackgroundchecksusa.com; www.onlinesearches.com; www.snoopstation.com; www.zabasearch.com; www.addresses.com; www.publicrecords.com; www.publicrecords.onlinesearches.com; www.peoplelookup.com; www.publicrecords360.com","d":"Intelius, US Search, US Search Pro"},{"n":"Intent IQ LLC","w":"intentiq.com","f":"g"},{"n":"Intentsify, LLC","w":"intentsify.io"},{"n":"Interactive Data, LLC","w":"ididata.com","f":"FL"},{"n":"Intermedia Ventures, LLC","w":"staterecords.org; courtrecords.us; californiacourtrecords.us","d":"StateRecords; CourtRecords"},{"n":"iovation Inc.","w":"transunion.com"},{"n":"IQVIA Digital Inc.","w":"iqviadigital.com; https:"},{"n":"Irys, Inc","w":"irys.us"},{"n":"iSpot.tv, Inc.","w":"ispot.tv","f":"gA"},{"n":"iWave Information Systems","w":"kindsight.io","d":"Kindsight"},{"n":"IXI Corporation","w":"equifax.com"},{"n":"J.D. Power","w":"jdpower.com"},{"n":"J2 Global Canada Inc.","w":"campaigner.com; https:","d":"Campaigner; SMTP"},{"n":"J2 Martech Corp","w":"fullcontact.com","d":"Full Contact, Blackbox, Alfred","f":"A"},{"n":"JDM LIST SERVICES","w":"jdmlistservices.com"},{"n":"JMR Media Consulting, Inc.","w":"jmr-media.com","d":"JMR Media"},{"n":"Juicebox App, Inc.","w":"juicebox.ai"},{"n":"Jun Group Productions, LLC","w":"jungroup.com","d":"Verve for Advertisers"},{"n":"Kargo Global LLC","w":"kargo.com"},{"n":"KB Synergy Inc","w":"kbsynergy.com","d":"KB Synergy"},{"n":"Key Marketing Advantage","w":"keymarketingadvantage.com"},{"n":"Keyword Connects LLC","w":"keywordconnects.com"},{"n":"Kind Skiptracing, Inc","w":"kindskiptracing.com"},{"n":"Kloudend, Inc.","w":"ipapi.co"},{"n":"Knowledge Works, Inc.","w":"sbinsights.paynetonline.com","d":"PayNet"},{"n":"Koddi, Inc","w":"koddi.com"},{"n":"Komodo Health, Inc.","w":"komodohealth.com","f":"A"},{"n":"Kontext Data","w":"kontextdata.com"},{"n":"L.S Mobile Apps Holdings LTD","w":"lsmapps.com"},{"n":"Labels & Lists, Inc","w":"l2-data.com","d":"L2, Inc","f":"gF"},{"n":"LEAD ENHANCE LLC","w":"lead-enhance.com"},{"n":"Lead Intelligence Inc.","w":"infutor.com","d":"InfutorData","f":"AC"},{"n":"Lead Me Media LLC","w":"leadmemedia.com","f":"g"},{"n":"Lead411 Corporation","w":"lead411.com; growjo.com; quickenrich.io","f":"A"},{"n":"LeadCrunch","w":"getrev.ai","d":"GetRev"},{"n":"LeadIQ, Inc","w":"leadiq.com"},{"n":"LeadPost LLC","w":"leadpost.com"},{"n":"Leadspace Inc","w":"leadspace.com"},{"n":"LearnMore, LLC","w":"learnmore.com","f":"g"},{"n":"Leidos Digital Solutions, Inc.","w":"leidosiq.com","f":"F"},{"n":"LexisNexis Risk Solutions FL Inc.","w":"risk.lexisnexis.com","f":"mgFL"},{"n":"LightBox Parent, L.P.","w":"lightboxre.com"},{"n":"Lightcast, LLC","w":"lightcast.io; rhetorik.com","d":"Economic Modeling; Rhetorik","f":"F"},{"n":"LionShare Marketing, Inc","w":"lionsharemarketing.com"},{"n":"ListKit LLC","w":"listkit.io"},{"n":"ListsOnline.com, Inc.","w":"everleads.com","d":"Everleads; ListsOnline; Internet Directory Publishers; Stanford Direct"},{"n":"Live Data Technologies, Inc.","w":"livedatatechnologies.com"},{"n":"LiveIntent","w":"liveintent.com","f":"g"},{"n":"LiveRamp Holdings, Inc.","w":"liveramp.com"},{"n":"LizDev,Inc","w":"lizdev.com"},{"n":"Lob.com, Inc.","w":"lob.com"},{"n":"Lookify.io","w":"lookify.io"},{"n":"LoopMe Limited","w":"loopme.com","d":"LoopMe PurchaseLoop; LoopMe Intelligent Marketplace; LoopMe, Inc.","f":"g"},{"n":"Lusha Systems, Inc","w":"lusha.com","d":"Lusha"},{"n":"M&R Strategic Services, Inc.","w":"mrss.com","d":"M+R"},{"n":"M1 Data & Analytics, LLC","w":"m1-data.com","f":"g"},{"n":"Madhive, Inc.","w":"madhive.com","d":"Madhive","f":"g"},{"n":"Magnite Inc","w":"magnite.com","f":"g"},{"n":"Malvern Media Inc.","w":"malvernmedia.com"},{"n":"Marketing Architects, Inc.","w":"marketingarchitects.com"},{"n":"MarketOps LLC","w":"marketops.com"},{"n":"MarketShare Partners, LLC","w":"transunion.com"},{"n":"Marriott International, Inc.","w":"marriott.com","f":"mg"},{"n":"Matchbook Data, LLC","w":"matchbookdata.com","f":"g"},{"n":"MaxMind, Inc.","w":"maxmind.com","d":"MaxMind","f":"FLA"},{"n":"Media.net Advertising FZ, LLC","w":"media.net"},{"n":"MediaWallah Inc","w":"mediawallah.com"},{"n":"MedPro Systems, LLC","w":"medprosystems.com","d":"MedPro Systems"},{"n":"Melissa Data Corporation","w":"melissa.com","d":"Melissa","f":"FL"},{"n":"Meltwater News US, Inc.","w":"meltwater.com","f":"FLA"},{"n":"Merkle Inc.","w":"merkle.com"},{"n":"Message Digital LLC","w":"messagedigital.com"},{"n":"MH Sub I, LLC","w":"internetbrands.com"},{"n":"Milestone Marketing Solutions","w":"milestonemarketingsolutions.com"},{"n":"Minerva BI Inc","w":"minerva.io","d":"Minerva"},{"n":"Mississippi Tornado Alley, LLC","w":"advancedbackgroundchecks.com; cyberbackgroundchecks.com; fastbackgroundcheck.com; fastpeoplesearch.com; peoplesearchnow.com; phonebooks.com; searchpeoplefree.com; smartbackgroundchecks.com; usa-people-search.com; usphonebook.com","d":"CyberBackgroundChecks.com; AdvancedBackgroundChecks.com; FastBackgroundCheck.com; PeopleSearchNow.com; Phonebooks.com; SearchPeopleFree.com; SmartBackgroundChecks.com; USA-People-Search.com; USPhoneBook.com; FastPeopleSearch.com"},{"n":"Mobile Technology Corporation","w":"onspotdata.com","d":"OnSpot Data","f":"g"},{"n":"MobileFuse LLC","w":"mobilefuse.com","d":"MobileFuse"},{"n":"Mobilewalla, Inc.","w":"mobilewalla.com","d":"Mobilewalla","f":"g"},{"n":"ModFx Labs Pvt Ltd","w":"modfxlabs.com","d":"ModFx Labs","f":"g"},{"n":"Modigie Inc","w":"modigie.com","d":"Modigie"},{"n":"Monocl AB","w":"account.monocl.com; https:","d":"Definitive Healthcare","f":"F"},{"n":"Moody\'s Corporation","w":"moodys.com","f":"FLA"},{"n":"MULTIMEDIA LISTS, INC.","w":"multimedialists.com"},{"n":"MV Digital Group, LLC","w":"cinqdi.com","d":"CinqDI"},{"n":"Nachal Inc.","w":"getliminal.com","d":"Liminal; iFish Digital; Lead Lure","f":"g"},{"n":"Narvar, Inc","w":"corp.narvar.com"},{"n":"National Data Analytics, LLC","w":"publicdatacheck.com","d":"publicdatacheck.com","f":"bg"},{"n":"National Opinion Institute, LLC","w":"nationalopinioninstitute.com","f":"F"},{"n":"Neptune Ops LLC","w":"neptuneops.com"},{"n":"NetWise Data, LLC","w":"netwisedata.com","d":"Dun and Bradstreet AB"},{"n":"Networx Systems Inc.","w":"networx.com","d":"Networx Systems Inc"},{"n":"Neustar Information Services, Inc.","w":"transunion.com","f":"mgF"},{"n":"NEUSTAR IP INTELLIGENCE, INC.","w":"transunion.com"},{"n":"New Mexico Data Insights","w":"newmexicodatainsights.com"},{"n":"NEXT WAVE MARKETING STRATEGIES, INC","w":"agedleadstore.com; nextwavemarketingstrategies.com","d":"agedleadstore.com"},{"n":"NextRoll, Inc.","w":"nextroll.com","d":"NextRoll Inc"},{"n":"Nexxen Inc","w":"nexxen.com"},{"n":"NFocus Consulting, Inc.","w":"n-focus.com","d":"NFocus","f":"bg"},{"n":"Nordic Data Resources AS","w":"nordicdataresources.com"},{"n":"NumLookup LLC.","w":"numlookup.com"},{"n":"Nuwber Inc","w":"nuwber.com"},{"n":"Ocean Global Inc","w":"ocean.io","f":"A"},{"n":"Ogury Ltd","w":"ogury.com"},{"n":"ONAUDIENCE LTD","w":"onaudience.com"},{"n":"Onfocus SAS","w":"adagio.io","d":"Adagio","f":"g"},{"n":"Online Advertising Network sp. z o.o.","w":"oan.pl; https:","d":"OAN; Online Advertising Network"},{"n":"Online Media Group Inc.","w":"omginc.xyz; www.mixrank.com","d":"MixRank"},{"n":"Opensend Inc","w":"opensend.com","d":"Opensend"},{"n":"OpenX Technologies, Inc.","w":"openx.com"},{"n":"Optable Technologies US Inc.","w":"optable.co","d":"Optable"},{"n":"Orgio, Inc.","w":"theorg.com","d":"The Org"},{"n":"Outlogic, LLC","w":"outlogic.io","f":"g"},{"n":"Outward Media Inc.","w":"outwardmedia.com"},{"n":"OWMN, LTD.","w":"thebridgecorp.com","d":"BRIDGE"},{"n":"Ownco, LLC","w":"monitorbase.com","d":"MonitorBase","f":"C"},{"n":"Pacific East Research Inc","w":"pacificeast.com","d":"PacificEast Research"},{"n":"PaeDae, Inc.","w":"infillion.com","f":"g"},{"n":"Paramount Lists, Inc.","w":"paramountdirectmarketing.com","d":"Paramount Direct Marketing"},{"n":"Path2Response, LLC","w":"path2response.com"},{"n":"Pen-Link, Ltd.","w":"penlink.com","d":"Penlink","f":"gFL"},{"n":"People Data Labs","w":"peopledatalabs.com"},{"n":"Peoplefinders, LLC","w":"peoplefinders.com; findaneighborhood.com","d":"FindANeighborhood"},{"n":"PeoplefindersDaaS","w":"peoplefindersdaas.com","d":"PFD; PFDAAS"},{"n":"Peoplewhiz, Inc","w":"peoplewhiz.com"},{"n":"Pipl, Inc.","w":"pipl.com","f":"FL"},{"n":"PitchBook Data Inc","w":"pitchbook.com","f":"FLA"},{"n":"Place Exchange, Inc.","w":"placeexchange.com","f":"g"},{"n":"PlaceIQ, Inc.","w":"precisely.com","d":"PlaceIQ; PIQ","f":"g"},{"n":"Pludo Inc","w":"cashmereai.com","d":"Cashmere"},{"n":"Plug Chargers LLC","w":"plug-industries.com","d":"Plug Industries"},{"n":"Plunge, LLC","w":"plungedigital.com","d":"Plunge Digital"},{"n":"PMG Worldwide, LLC","w":"pmg.com"},{"n":"Podible Inc","w":"podscribe.com","d":"Podscribe"},{"n":"Pop Acta Media, LLC","w":"popacta.com","d":"Pop Acta Media"},{"n":"Populi LLC","w":"definitivehc.com","d":"Definitive Healthcare","f":"F"},{"n":"PossibleNOW, Inc.","w":"possiblenow.com"},{"n":"Postie, Inc","w":"postie.com"},{"n":"PostPilot, Inc.","w":"postpilot.com"},{"n":"Precisely Software Incorporated","w":"precisely.com; www.cloud.precisely.com; www.cloudnative.precisely.com; www.data.precisely.com; www.developer.precisely.com; www.geotax.com; www.mapinfomarketplace.precisely.com; www.portal.spectrum.precisely.com","d":"Precisely","f":"g"},{"n":"Predactiv","w":"predactiv.com","d":"ShareThis"},{"n":"Predictive Pop, Inc.","w":"audigent.com","d":"Audigent"},{"n":"Preqin Ltd","w":"preqin.com","f":"FL"},{"n":"Private Records LLC","w":"privaterecords.net; peoplesearch123.com; backgroundcheckers.net; personsearchers.com"},{"n":"PrivCo Holding Inc","w":"privco.com","d":"PrivCo Media LLC"},{"n":"Project Affinity, Inc.","w":"affinity.co","d":"Affinity","f":"A"},{"n":"Property Reach, L.P.","w":"propertyreach.com; leadsherpa.com","d":"LeadSherpa"},{"n":"PropertyRadar, Inc.","w":"propertyradar.com","f":"gFL"},{"n":"ProspectBase UK Limited","w":"prospectbase.com"},{"n":"PublicRecordCom, LLC","w":"publicrecord.com","f":"g"},{"n":"PubMatic Inc.","w":"pubmatic.com","d":"Yes","f":"g"},{"n":"PulsePoint, Inc.","w":"pulsepoint.com","d":"PulsePoint"},{"n":"Quad Graphics, Inc.","w":"quad.com","d":"Quad; Rise"},{"n":"Quadrant Global Pte. Ltd.","w":"quadrant.io","f":"g"},{"n":"Qualfon","w":"qualfon.com","d":"Dialog Direct"},{"n":"Quorum Data, Inc","w":"quorum.inc; app.quorum.live","f":"g"},{"n":"Qurium Solutions, Inc.","w":"supplier.io","d":"Supplier.io"},{"n":"R.L. Polk & Co.","w":"mobilityglobal.com; www.spglobal.com","d":"Mobility Global; S&P Global"},{"n":"Rainbarrel USA LLC","w":"knowertech.com","f":"g"},{"n":"RampedUp","w":"rampedup.io"},{"n":"Randall-Reilly, LLC","w":"fusable.com","d":"Fusable","f":"A"},{"n":"Ray CDP, Inc.","w":"rayinsights.com; www.raycdp.com","d":"Ray Insights, Inc."},{"n":"REAL INTENT INC","w":"realintent.co"},{"n":"Realeflow LLC","w":"realeflow.com; www.leadflow.com"},{"n":"ReallyGreatRate, Inc","w":"rgrmarketing.com","d":"RGR Marketing"},{"n":"RealSource, Inc","w":"realsourcedata.com"},{"n":"RecruitBot","w":"recruitbot.com"},{"n":"Redi-Data Inc","w":"redidata.com"},{"n":"Redmob LLC","w":"redmob.io","d":"Redmob"},{"n":"Reklaim Ltd.","w":"reklaimyours.com","d":"Reklaim"},{"n":"RelPro, Inc.","w":"relpro.com"},{"n":"RELX Inc.","w":"lexisnexis.com","d":"LexisNexis","f":"FL"},{"n":"Remodeling.com, LLC","w":"remodeling.com"},{"n":"Resonate","w":"resonate.com"},{"n":"Response America, Inc.","w":"responseamerica.net"},{"n":"RevContent, LLC","w":"revcontent.com"},{"n":"Reveal Mobile, Inc.","w":"revealmobile.com","f":"g"},{"n":"Revelio Labs, Inc.","w":"reveliolabs.com"},{"n":"Revenue Roll Inc.","w":"meettie.com","d":"Tie","f":"g"},{"n":"RevenueBase, Inc","w":"revenuebase.ai","d":"RevenueBase"},{"n":"RevOptimal, LLC","w":"revoptimal.com"},{"n":"Rich Media LLC","w":"richmediallc.com"},{"n":"Ripple Effect Strategies","w":"ripple-fx.com; ripple-roi.com"},{"n":"RocketReach LLC","w":"rocketreach.co","f":"FLA"},{"n":"Roq.ad Inc.","w":"roq.ad"},{"n":"ROR Partners, LLC","w":"rorpartners.com","d":"ROR Partners"},{"n":"Round Sky, Inc.","w":"roundsky.com"},{"n":"Rushmore Labs, LLC","w":"rushmorelabs.com; https:","d":"Censai Analytics","f":"F"},{"n":"S&P Global Inc","w":"spglobal.com","f":"g"},{"n":"Sabio Inc","w":"sabioctv.com"},{"n":"SalesIntel Research, Inc.","w":"salesintel.io"},{"n":"Salutary Data LLC.","w":"salutarydata.com"},{"n":"Samba TV, Inc.","w":"samba.tv"},{"n":"SBFE, LLC","w":"sbfe.org"},{"n":"Scalable Commerce LLC","w":"kidslivesafe.com; quickpublicrecords.com","d":"kidslivesafe.com, quickpublicrecords.com","f":"bg"},{"n":"SciLeads Ltd","w":"scileads.com"},{"n":"Seamless Contacts, Inc.","w":"seamless.ai","d":"Seamless"},{"n":"SEMANTIQ INC","w":"semantiqhealth.com"},{"n":"Semasio GmbH","w":"semasio.com","d":"Semasio"},{"n":"Semcasting, Inc.","w":"semcasting.com","f":"g"},{"n":"Share Local Media, Inc.","w":"sharelocalmedia.com"},{"n":"Sharethrough","w":"sharethrough.com","f":"g"},{"n":"SheerID, Inc.","w":"sheerid.com","d":"SheerID"},{"n":"Similarweb Ltd.","w":"similarweb.com","f":"A"},{"n":"Simio Cloud, LLC","w":"simiocloud.com"},{"n":"Site Impact LLC","w":"siteimpact.com"},{"n":"Skydeo Inc.","w":"skydeo.com"},{"n":"Slashdot Media, LLC","w":"slashdotmedia.com; www.sourceforge.net; www.slashdot.org; www.voipreview.org; www.linuxjournal.com; www.myrateplan.com; wirefly.com","d":"Slashdot Media; Sourceforge; VoipReview; Slashdot; Linux Journal; My Rate Plan; Wirefly"},{"n":"SMARTe Inc","w":"smarte.pro"},{"n":"Snovio Inc","w":"snov.io"},{"n":"Social Catfish, LLC","w":"socialcatfish.com"},{"n":"Sojern, Inc","w":"sojern.com","d":"Sojern"},{"n":"Solar Connect, LLC","w":"bluefireleads.com; homeupgradepros.us; americanroofers.org; homeupgradepros.net; homeupgradeprofessionals.us; xpertroofers.com; homeupgradepros.org; homeupgradepros.io; homeupgradeprofessionals.net; kwikac.com; homeupgradeprofessionals.com; kwiksiding.com; kwik-kitchen.com; upgradepros.services; betterhousenow.com; kwikroofs.com","d":"Blue Fire Leads; Home Upgrade Professionals; Home Upgrade Pros; Stratos Media; Verified Solar; Solar Partnr; Home Heroes"},{"n":"Source Path Digital","w":"sourcepathdigital.com"},{"n":"Sovrn, Inc.","w":"sovrn.com","f":"A"},{"n":"Specialists Marketing Services, Inc.","w":"sms-inc.com"},{"n":"Speedeon Data LLC","w":"speedeondata.com","d":"Speedeon Data, LLC"},{"n":"Spokeo, Inc.","w":"spokeo.com; www.freepeopledirectory.com; www.thatsthem.com; www.peoplewin.com; www.anywho.com; www.family.me","d":"Spokeo.com; Freepeopledirectory.com; Thatsthem.com; Peoplewin.com; Anywho.com; Family.me","f":"FL"},{"n":"Sports Innovation Lab, inc.","w":"sportsilab.com"},{"n":"Sprout Social, Inc.","w":"sproutsocial.com","f":"A"},{"n":"Spy Labs AdCo, LLC","w":"spydialer.com","d":"Spydialer.com"},{"n":"SpyCloud Inc.","w":"spycloud.com","f":"mgFL"},{"n":"StackAdapt Inc.","w":"stackadapt.com","d":"StackAdapt","f":"gr"},{"n":"Statara Solutions LLC","w":"statara.com"},{"n":"StatSocial","w":"statsocial.com"},{"n":"Steppingblocks, Inc.","w":"steppingblocks.com"},{"n":"Sterling Data Company LLC","w":"sterling.ai"},{"n":"Stirista, LLC","w":"stirista.com; www.lbdigitaldata.com; www.mediasourcesolutions.com; ameribase.com; www.lighthouselist.com; www.andrewswharton.com; www.listconnection.net; www.magnetik.com","d":"Stirista; 123Push; LBDigital; Media Source Solutions; Customer Portfolios; Portfolio Solutions; Ameribase Digital; Lighthouse Lists; Andrews Wharton; Adstir; List Builder 360; List Connection; Magnetik"},{"n":"Strategic Data Intelligence, LLC","w":"strategicdataintelligence.com"},{"n":"Subdirect LLC","w":"www360mediadirect.com","d":"360 Media Direct; bPerx; AdSmith; Subco; ClicknRead; WRSS"},{"n":"Subgraph, Inc","w":"subgraph.tech"},{"n":"Summit Resources, LLC","w":"clientcommand.com","d":"Client Command"},{"n":"Swarm Holdings, Inc.","w":"theswarm.com","f":"A"},{"n":"Swoop.com Inc","w":"swoop.com"},{"n":"Swordfish AI Inc","w":"swordfish.ai","d":"Swordfish AI"},{"n":"T-Mobile USA, Inc.","w":"t-mobile.com","f":"g"},{"n":"Taboola, Inc.","w":"taboola.com"},{"n":"Tagis Inc","w":"amplemarket.com","d":"Amplemarket"},{"n":"Tapad","w":"experian.com"},{"n":"TargetSmart Communications LLC","w":"targetsmart.com"},{"n":"Task Genie, Inc.","w":"datalane.com","d":"Datalane"},{"n":"Tauxbe Data Inc.","w":"tauxbe.com; www.natcrim.com","f":"C"},{"n":"Teads Holding Co","w":"outbrain.com"},{"n":"Teads Inc","w":"teads.com"},{"n":"TechTarget, Inc","w":"informatechtarget.com; https:","d":"Informa TechTarget"},{"n":"Telesign Corporation","w":"telesign.com"},{"n":"The Alesco Group LLC","w":"alescodata.com","d":"Alesco Data LLC; Response Solutions LLC; Statlistics Resource Group LLC","f":"FL"},{"n":"The Data Group, LLC","w":"thedatagroup.com"},{"n":"THE LINEA 1 MKT SL","w":"tl1mkt.com"},{"n":"The Nielsen Company, LLC","w":"nielsen.com","d":"Nielsen Marketing Cloud"},{"n":"The People Searchers LLC","w":"peoplesearcher.com; http:"},{"n":"The Segerdahl LLC","w":"sg360.com","d":"SG360"},{"n":"Think Data Group Inc","w":"thinkdatagroup.com","d":"Think Data Group"},{"n":"Traackr, Inc.","w":"traackr.com"},{"n":"Trans Union LLC","w":"transunion.com","d":"TransUnion","f":"mC"},{"n":"TransUnion Digital LLC","w":"transunion.com"},{"n":"TransUnion Interactive, Inc.","w":"transunion.com","f":"b"},{"n":"TransUnion Risk and Alternative Data Solutions, Inc.","w":"transunion.com","f":"bFA"},{"n":"Trestle Solutions, Inc.","w":"trestleiq.com"},{"n":"TripleLift, Inc.","w":"triplelift.com","f":"g"},{"n":"True Blue Analytics LLC","w":"trueblueanalytics.org"},{"n":"TrueData Solutions, Inc.","w":"truedata.co","d":"TrueData"},{"n":"TRUSTID, Inc.","w":"transunion.com"},{"n":"Truth Now LLC","w":"checksecrets.com; peoplesearchusa.org; inmatesearcher.com; sealedrecords.net"},{"n":"Truthed, Inc","w":"truthed.com"},{"n":"TruthFinder, LLC","w":"truthfinder.com; www.courthousedirectory.us; www.getfullreport.com; www.unitedstatesbackgroundchecks.com; www.courtlocations.com; www.locaterecord.net; www.recordlocator.net; www.backgroundchecks.us","d":"TruthFinder"},{"n":"TSG Holdco, LLC","w":"finthrive.com"},{"n":"Tunnl, LLC","w":"tunnldata.com"},{"n":"Unacast, Inc.","w":"unacast.com","d":"Unacast","f":"gF"},{"n":"Unearth Campaigns LLC","w":"unearthcampaigns.com; www.atlasinfluence.com","d":"Atlas Influence Targeting"},{"n":"UNMASK, LLC","w":"unmask.com","f":"g"},{"n":"upcell, LLC","w":"upcell.io","d":"upcell"},{"n":"Uplead LLC","w":"uplead.com"},{"n":"UPS Capital Corporation","w":"upscapital.com; insureshield.com"},{"n":"Urban Science Applications, Inc.","w":"urbanscience.com","d":"Urban Science; USAI"},{"n":"US Data Corporation","w":"usdatacorporation.com"},{"n":"USADATA, Inc","w":"usadata.com","d":"USADATA Inc"},{"n":"USPeopleSearch.com, LLC","w":"uspeoplesearch.com","f":"g"},{"n":"Valassis Communications, Inc.","w":"rrd.com","d":"Valassis Communications, Inc., an RRD Company","f":"g"},{"n":"Veeva Systems Inc.","w":"veeva.com"},{"n":"Vendelux, Inc.","w":"vendelux.com","d":"Vendelux"},{"n":"Venntel, Inc.","w":"venntel.com","d":"Venntel","f":"gF"},{"n":"VentiveIQ LLC","w":"ventiveiq.com"},{"n":"Veraset, LLC","w":"veraset.com","f":"gF"},{"n":"Versar Data Solutions Inc","w":"versium.com; www.datafinder.com","d":"Versium Analytics, Inc."},{"n":"Vertical Int, Inc.","w":"enrichlayer.com","d":"Enrich Layer"},{"n":"Vi Technologies, Inc.","w":"vi.co","f":"gr"},{"n":"Viant US LLC","w":"viantinc.com","d":"Adelphic LLC; Viant Technology LLC","f":"g"},{"n":"VideoAmp, Inc.","w":"videoamp.com","f":"g"},{"n":"Virtual Marketing LLC","w":"fusion92.com","d":"Fusion92","f":"g"},{"n":"VisitIQ LLC","w":"visitiq.io","f":"g"},{"n":"Vistar Media Inc.","w":"vistarmedia.com","f":"g"},{"n":"Visual Visitor L.L.C.","w":"visualvisitor.com"},{"n":"VIZIO Services, LLC","w":"vizio.com; https:"},{"n":"Voxtur Data Services","w":"benutech.com","d":"Benutech Inc"},{"n":"VRTCAL Markets Inc.","w":"vrtcal.com","f":"mg"},{"n":"Warmly, Inc.","w":"warmly.ai","f":"A"},{"n":"We Inform LLC","w":"weinform.org; www.truthrecord.org"},{"n":"WealthFeed, Inc.","w":"wealthfeed.com"},{"n":"Webbula, LLC","w":"webbula.com"},{"n":"West Publishing Corp","w":"thomsonreuters.com","f":"FLA"},{"n":"Whitepages, Inc","w":"whitepages.com"},{"n":"Wiland, Inc.","w":"wiland.com"},{"n":"Windfall Data, Inc.","w":"windfall.com"},{"n":"WINR Data Pty Ltd","w":"winrdata.com","d":"WINR Data"},{"n":"Wiza, Inc.","w":"wiza.com"},{"n":"Wunderkind Corporation","w":"wunderkind.co","d":"Wunderkind"},{"n":"WURL, LLC","w":"wurl.com","d":"WURL"},{"n":"xAd, Inc.","w":"groundtruth.com","d":"GroundTruth","f":"g"},{"n":"Xcelerated Data LLC","w":"xcelerated.com"},{"n":"Yieldmo, Inc.","w":"yieldmo.com"},{"n":"Yobi Ventures, Inc.","w":"yobi.ai","d":"Yobi AI"},{"n":"Zenleads, Inc.","w":"apollo.io","d":"Apollo.io"},{"n":"ZeroToOne.AI Inc.","w":"zerotoone.ai","f":"g"},{"n":"Zeta Global","w":"zetaglobal.com","f":"g"},{"n":"Ziff Davis LLC","w":"ziffdavis.com","f":"gr"},{"n":"ZipStorm, Inc.","w":"seekout.com","d":"SeekOut"},{"n":"ZoomInfo Technologies, LLC","w":"zoominfo.com","d":"ZoomInfo"},{"n":"ZS Associates, Inc.","w":"zs.com"}]';
const BROKERS = JSON.parse(REGISTRY_JSON);

/* ── Storage: chrome.storage.local, with a localStorage fallback so the page
      is inspectable outside an extension context during development. ───── */

const store = (() => {
  const hasExt = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  return {
    backend: hasExt ? 'chrome.storage.local' : 'localStorage',
    async get(keys) {
      if (hasExt) return chrome.storage.local.get(keys);
      const out = {};
      for (const k of keys) {
        const v = localStorage.getItem(k);
        if (v !== null) { try { out[k] = JSON.parse(v); } catch { out[k] = v; } }
      }
      return out;
    },
    async set(obj) {
      if (hasExt) return chrome.storage.local.set(obj);
      for (const [k, v] of Object.entries(obj)) localStorage.setItem(k, JSON.stringify(v));
    },
    async remove(keys) {
      if (hasExt) return chrome.storage.local.remove(keys);
      for (const k of keys) localStorage.removeItem(k);
    }
  };
})();

/* ── Date helpers. All dates are plain YYYY-MM-DD and handled in local time,
      so a timezone offset can never shift a milestone by a day. ─────────── */

function parseISO(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return null;
  return d;
}
function toISO(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function addDays(d, n) { const c = new Date(d.getTime()); c.setDate(c.getDate() + n); return c; }
function today() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
function fmt(d) {
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}
function daysBetween(a, b) { return Math.round((b - a) / 86400000); }
function relative(target, now) {
  const n = daysBetween(now, target);
  if (n === 0) return 'today';
  if (n > 0) return n === 1 ? 'tomorrow' : `in ${n} day${n === 1 ? '' : 's'}`;
  const p = -n;
  return p === 1 ? 'yesterday' : `${p} days ago`;
}

const $ = id => document.getElementById(id);

/* ── Residency gate ──────────────────────────────────────────────────── */

const GATE_TEXT = {
  'ca':     'You told us you’re a California resident.',
  'non-ca': 'You told us you live outside California.',
  'unsure': 'You weren’t sure — both paths are shown below.'
};

function applyResidency(value) {
  const caFlow  = $('ca-flow');
  const nonCa   = $('non-ca');
  const choices = $('gate-choices');
  const answered = $('gate-answered');

  if (!value) {
    caFlow.hidden = true;
    nonCa.hidden = true;
    choices.hidden = false;
    answered.hidden = true;
    return;
  }

  caFlow.hidden = !(value === 'ca' || value === 'unsure');
  nonCa.hidden  = !(value === 'non-ca' || value === 'unsure');
  choices.hidden = true;
  answered.hidden = false;
  $('gate-answered-text').textContent = GATE_TEXT[value] || '';
}

function wireGate() {
  document.querySelectorAll('[data-residency]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const v = btn.getAttribute('data-residency');
      applyResidency(v);
      await store.set({ [STORAGE_KEYS.residency]: v });
      const target = v === 'non-ca' ? $('non-ca') : $('ca-flow');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  $('gate-change').addEventListener('click', async () => {
    applyResidency(null);
    await store.remove([STORAGE_KEYS.residency]);
    $('gate-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/* ── Submission record + reminder ────────────────────────────────────────
   The reminder is built around the verified answer to "does a DROP request
   need renewing?" — it does not. CalPrivacy: "DROP is ongoing – not a
   one-time action." So we never prompt a resubmission. We surface (a) when
   status data should actually exist, and (b) a periodic nudge to add new
   identifiers, which is the only user action that changes anything.        */

function milestones(submitted) {
  const now = today();
  const brokersStart = parseISO(BROKER_PROCESSING_START);
  // Brokers were only obliged to start on 2026-08-01; a request filed before
  // that sits at "Pending" until then, so the 90-day clock runs from whichever
  // is later.
  const processingFrom = submitted > brokersStart ? submitted : brokersStart;
  const reportBy = addDays(processingFrom, REPORT_WINDOW_DAYS);

  const rows = [];
  rows.push({ date: submitted, what: 'You submitted your DROP request.', done: submitted <= now });

  if (submitted < brokersStart) {
    rows.push({
      date: brokersStart,
      what: 'Data brokers legally required to begin processing. Before this date every status reads "Pending".',
      done: brokersStart <= now
    });
  }

  rows.push({
    date: reportBy,
    what: `Brokers have until here to report how they processed your request (${REPORT_WINDOW_DAYS} days). A status check before this mostly shows "Pending".`,
    done: reportBy <= now,
    next: reportBy > now
  });

  // After the report window, the only meaningful recurring action is adding new
  // identifiers. Deliberately framed as optional.
  let review = addDays(reportBy, PROFILE_REVIEW_DAYS);
  while (review <= now) review = addDays(review, PROFILE_REVIEW_DAYS);
  rows.push({
    date: review,
    what: 'Suggested check-in: add any new phone, email, address, MAID or VIN to the same profile. Optional — there is no resubmission step.',
    next: reportBy <= now
  });

  return { rows, reportBy, now };
}

function renderRecord(iso) {
  const submitted = parseISO(iso);
  if (!submitted) { showIdle(); return; }

  $('record-idle').hidden = true;
  $('record-done').hidden = false;
  $('recorded-date').textContent = fmt(submitted);

  const { rows, reportBy, now } = milestones(submitted);

  const tl = $('timeline');
  tl.textContent = '';
  for (const r of rows) {
    const row = document.createElement('div');
    row.className = 'tl-row' + (r.done ? ' done' : '') + (r.next ? ' next' : '');
    const d = document.createElement('span');
    d.className = 'tl-date';
    d.textContent = toISO(r.date);
    const w = document.createElement('span');
    w.className = 'tl-what';
    w.textContent = r.what;
    row.append(d, w);
    tl.appendChild(row);
  }

  const nc = $('next-check');
  nc.textContent = '';
  const pill = document.createElement('span');
  pill.className = 'pill';
  const msg = document.createElement('span');

  if (reportBy > now) {
    pill.textContent = 'next check';
    msg.textContent = `Status data should be meaningful by ${fmt(reportBy)} (${relative(reportBy, now)}). Checking earlier is fine — expect "Pending". You do not need to resubmit; your request stays in force and brokers must re-check at least every ${RECHECK_DAYS} days.`;
  } else {
    pill.textContent = 'ready now';
    msg.textContent = `The ${REPORT_WINDOW_DAYS}-day reporting window closed on ${fmt(reportBy)} — status data should be there now. Your request remains in force with no action from you; brokers must keep re-checking at least every ${RECHECK_DAYS} days.`;
  }
  nc.append(pill, msg);
}

function showIdle() {
  $('record-idle').hidden = false;
  $('record-done').hidden = true;
  const input = $('submit-date');
  if (!input.value) input.value = toISO(today());
  input.max = toISO(today());
}

function wireRecord() {
  $('record-save').addEventListener('click', async () => {
    const raw = $('submit-date').value;
    const d = parseISO(raw);
    const err = $('record-error');

    if (!d) {
      err.hidden = false;
      err.textContent = 'Enter a valid date.';
      return;
    }
    if (d > today()) {
      err.hidden = false;
      err.textContent = 'That date is in the future — record it once you have actually submitted.';
      return;
    }
    err.hidden = true;
    await store.set({ [STORAGE_KEYS.submitted]: raw });
    renderRecord(raw);
  });

  $('record-clear').addEventListener('click', async () => {
    await store.remove([STORAGE_KEYS.submitted]);
    showIdle();
  });
}

/* ── Registry browser ────────────────────────────────────────────────── */

let activeFlag = '';
let query = '';

function countFlag(f) { return BROKERS.reduce((n, b) => n + ((b.f || '').includes(f) ? 1 : 0), 0); }

function matches(b) {
  if (activeFlag && !(b.f || '').includes(activeFlag)) return false;
  if (!query) return true;
  const q = query.toLowerCase();
  return b.n.toLowerCase().includes(q)
      || (b.w || '').toLowerCase().includes(q)
      || (b.d || '').toLowerCase().includes(q);
}

function renderBrokers() {
  const list = $('broker-list');
  const results = BROKERS.filter(matches);

  list.textContent = '';

  if (!results.length) {
    const e = document.createElement('p');
    e.className = 'empty';
    e.textContent = 'No registered broker matches that.';
    list.appendChild(e);
    $('result-count').textContent = `0 of ${BROKERS.length}`;
    return;
  }

  const frag = document.createDocumentFragment();
  for (const b of results) {
    const row = document.createElement('div');
    row.className = 'broker';
    row.setAttribute('role', 'listitem');

    const main = document.createElement('div');
    main.className = 'b-main';

    const name = document.createElement('div');
    name.className = 'b-name';
    name.textContent = b.n;
    main.appendChild(name);

    if (b.d) {
      const dba = document.createElement('div');
      dba.className = 'b-dba';
      dba.textContent = 'dba ' + b.d;
      main.appendChild(dba);
    }
    if (b.w) {
      const site = document.createElement('div');
      site.className = 'b-site';
      site.textContent = b.w;
      main.appendChild(site);
    }
    row.appendChild(main);

    if (b.f) {
      const flags = document.createElement('div');
      flags.className = 'b-flags';
      for (const ch of b.f) {
        const meta = FLAG_META[ch];
        if (!meta) continue;
        const tag = document.createElement('span');
        tag.className = 'b-flag' + (meta.hot ? ' hot' : '');
        tag.textContent = meta.label;
        tag.title = meta.title;
        flags.appendChild(tag);
      }
      row.appendChild(flags);
    }

    frag.appendChild(row);
  }
  list.appendChild(frag);

  $('result-count').textContent = results.length === BROKERS.length
    ? `${BROKERS.length} registered brokers`
    : `${results.length} of ${BROKERS.length} brokers`;
}

function wireRegistry() {
  const search = $('broker-search');
  search.placeholder = `Search ${BROKERS.length} brokers by name or domain…`;
  search.addEventListener('input', () => { query = search.value.trim(); renderBrokers(); });

  document.querySelectorAll('.filt').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFlag = btn.getAttribute('data-flag') || '';
      renderBrokers();
    });
  });

  $('stat-total').textContent = String(BROKERS.length);
  $('stat-geo').textContent   = String(countFlag('g'));
  $('stat-genai').textContent = String(countFlag('A'));
  $('stat-fed').textContent   = String(countFlag('F'));
  $('does-count').textContent = String(BROKERS.length);

  const snap = $('snapshot-line');
  snap.textContent = '';
  snap.append(document.createTextNode(
    `Snapshot of CalPrivacy's machine-readable registry CSV, taken ${SNAPSHOT_DATE}: ${BROKERS.length} registered brokers. ` +
    `CalPrivacy's own page says "over 600". Flags are self-reported by each broker on its registration. ` +
    'Brokers register annually in January, so this list drifts — the live registry is authoritative: '
  ));
  const a = document.createElement('a');
  a.href = SOURCES.registry;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = 'cppa.ca.gov/data_broker_registry ↗';
  snap.appendChild(a);
}

/* ── Boot ────────────────────────────────────────────────────────────── */

async function init() {
  wireGate();
  wireRecord();
  wireRegistry();
  renderBrokers();

  const saved = await store.get([STORAGE_KEYS.residency, STORAGE_KEYS.submitted]);
  applyResidency(saved[STORAGE_KEYS.residency] || null);

  const iso = saved[STORAGE_KEYS.submitted];
  if (iso) renderRecord(iso); else showIdle();
}

document.addEventListener('DOMContentLoaded', init);
