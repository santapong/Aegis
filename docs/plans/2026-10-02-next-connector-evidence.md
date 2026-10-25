# Next-connector evidence board

October 2, 2026. M4.4 remains open until actual authorized LINE use is reviewed. This board records limited current technical research, not a connector commitment or permission to configure another service.

| Candidate | Primary-source observations | Aegis question still requiring evidence |
| --- | --- | --- |
| WhatsApp Cloud API | Meta's official collection uses a WhatsApp Business Account and business phone-number identity, bearer permissions including `whatsapp_business_messaging`/`whatsapp_business_management`, and subscription of the app to the WABA for webhook events. | Do enough pilot users prefer this channel to justify business asset setup, permitted delivery rules, operational costs and the same explicit confirmation boundary? |
| Instagram messaging | Meta's Send API collection describes professional-account messaging, `instagram_business_manage_messages`, an access token from that account and a recipient who first messaged it. Group messaging is unsupported in this documented API. | Is a professional inbox appropriate for private personal cash capture, and can the account/participant ownership and retention rules be made clear? |
| Accounting/receipt intake | No connector requirements were verified in this pass. | Which actual manual task failed in the LINE pilot, and would an import or receipt review solve it more directly? |

Sources checked: [Meta WhatsApp collection](https://www.postman.com/meta/whatsapp-business-platform/overview), [Cloud API assets and permissions](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api?entity=folder-13382743-ba8d099d-007e-4b52-b9f2-3cf3c60e4fbc), [business phone-number identity](https://www.postman.com/meta/whatsapp-business-platform/request/e9ady51/get-phone-numbers), [Meta Instagram Send API](https://www.postman.com/meta/instagram/folder/uxudqu0/send-api). These are the platform publisher's collections, not community integration advice.

Direct Meta developer pages for the platform overview and Instagram messaging returned HTTP 429 during this check. The Instagram description was available in its indexed publisher collection, while a later direct open returned only its shell. Detailed current review/verification eligibility, message windows, templates, pricing and terms were not fully rechecked. Reopen the official documentation before any next-connector decision or promise; do not infer those details from old/community setup guides.

After the real LINE pilot, record whether users can correctly choose the destination, confirm once, find their recorded movement, correct it and recognize delayed delivery. Compare task friction with manual entry. Choose one bounded next task from observed demand, and document account requirements and operational terms before implementation. Until then, the decision is pending.
