---
title: Journeys
description: 'A journey is one thing a customer or a system asks Billpay to do, followed from the request to the money settling. Temporal workflows run it, one or several in turn.'
---

import Lead from '@site/src/components/Lead';
import SectionIndex from '@site/src/components/SectionIndex';

# Journeys

<Lead>A journey is one thing a customer or a system asks Billpay to do, followed from the request to the money settling. Temporal workflows run it, one or several in turn.</Lead>

Most journeys start with a customer on a payment page, who waits for an answer. The rest start with an event, a callback or a date, with nobody waiting. These pages go from the page a customer sees, to what each journey does, to every layer a single journey passes through.

## In this section

<SectionIndex
  items={[
    {
      term: 'Make a Payment Journey',
      to: '/docs/design/journeys/make-a-payment',
      desc: `The payment page a channel shows, the four calls behind it, and how the Router turns the customer's answers into one journey.`,
    },
    {
      term: 'All Journeys',
      to: '/docs/design/journeys/all-journeys',
      desc: `Every journey end to end, from the channel or event that starts it to the money settling, with the state the payment holds after each step.`,
    },
    {
      term: 'The Complete Picture',
      to: '/docs/design/journeys/complete-picture',
      desc: `One journey at a time, through every layer: the customer, One-Data, the API and the Router, the workflows, the systems they call, and Oracle.`,
    },
  ]}
/>
