// Built-in project template gallery (shown under Templates, like Teamwork's own templates)
const T = (name, color, lists) => ({ name, color, content: { tasklists: lists.map(([n, tasks]) => ({ name: n, tasks })) } })

export const BUILTIN_TEMPLATES = {
  Recommended: [
    T('Creative Requests', '#c8f1f5', [['Sales Collateral Requests', ['Design deck for customer visit', 'One-pager for sales team']], ['Website Design Requests', ['New illustration for homepage', 'New image for testimonial page', 'Design for pop-up announcement']], ['Internal Marketing Requests', ['Featured image for blog post']]]),
    T('Design Project Management', '#c8f1f5', [['Sales Collateral Requests', ['Customer presentation', 'Sales battlecard', 'LinkedIn promotion graphics']], ['Website Design Requests', ['Homepage illustration', 'Pricing page design', 'Customer testimonial image']], ['Internal Marketing Requests', ['eBook: Marketing Best Practices']]]),
    T('Project Management Plan', '#c8f1f5', [['Initiation', ['Develop the Project Charter', 'Identify and log stakeholders']], ['Project Management Plan - Research', ['Schedule and host meetings', 'Schedule a kick-off meeting', 'Conduct data gathering / analysis']], ['Develop Scope Management Plan', ['Create a Scope Management Plan']]]),
    T('Project Tracker', '#c8f1f5', [['Sprint 1', ['Create pitch deck', 'Present proposal for sign off']], ['Sprint 2', ['Write first draft', 'Design mockups', 'Gather feedback']], ['Sprint 3', ['Finalize design']]]),
    T('Task Management', '#d6f7e6', [['Sprint 1', ['Create pitch deck', 'Present proposal for sign off']], ['Sprint 2', ['Write first draft', 'Design mockups', 'Gather feedback']], ['Sprint 3', ['Finalize design']]]),
    T('Crewdesk Onboarding', '#c8f1f5', [['Getting your team on board', ['Licenses and Permissions', 'Getting your team on Crewdesk']], ['Naming Conventions & Default Configuration', ['Configuring your site and default settings', 'Establishing naming conventions for your site']], ['Team Communication', ['Getting comfortable with Messages', 'Getting comfortable with Comments']]]),
  ],
  Marketing: [
    T('Account Management', '#c9d3f7', [['New clients', ['Central City Police Department', 'Virginia University Labs', 'Globodyne']], ['Current clients', ['The Daily Planet', 'A-Force']], ['Past clients', ['Nova Venture']]]),
    T('Advertising Campaign', '#c9d3f7', [['Research and preparation', ['Set budget approval', 'Identify audience for campaign', 'Set campaign goals']], ['Assets', ['Write creative brief', 'Design ad assets']], ['Tracking and reporting', ['Create tracking URLs']]]),
    T('Blog Planner', '#c9d3f7', [['New', ['Using Crewdesk projects for marketing excellence', '5 ways to use Crewdesk tools', 'Top 10 growth tracking ideas']], ['Published', ['Using board view for Crewdesk projects', 'How to start a blog in 5 hours']], ['Archived', ['Marketing best practices']]]),
    T('Content Calendar', '#c9d3f7', [['This month', ['Plan social posts', 'Write newsletter', 'Schedule webinar']], ['Next month', ['Draft case study', 'Record podcast episode']]]),
    T('Event Planning', '#c9d3f7', [['Before the event', ['Book venue', 'Send invitations', 'Arrange catering']], ['On the day', ['Registration desk', 'Run of show']], ['After the event', ['Send thank-you emails', 'Share recordings']]]),
    T('Product Launch', '#c9d3f7', [['Plan', ['Define positioning', 'Set launch date']], ['Build', ['Landing page', 'Launch video', 'Press kit']], ['Launch', ['Announce on social', 'Email customers', 'Measure results']]]),
  ],
  'Professional services': [
    T('Client Onboarding', '#ffe7c2', [['Welcome', ['Send welcome pack', 'Kick-off call']], ['Setup', ['Collect access and assets', 'Agree on timeline']], ['Handover', ['Introduce account manager']]]),
    T('Book Publishing', '#ffe7c2', [['Manuscript', ['Receive manuscript', 'Editing and proofreading']], ['Design', ['Cover design', 'Interior formatting']], ['Publishing', ['ISBN and barcode', 'Publish on Amazon and Kindle', 'Author page setup']]]),
    T('Website Build', '#ffe7c2', [['Discovery', ['Sitemap', 'Wireframes']], ['Design', ['Homepage design', 'Inner pages']], ['Development', ['Build pages', 'QA and launch']]]),
  ],
}
