import { db_ws as db } from "@/db"
import { agentRoles, voicePresets } from "@/db/schema"
import { eq } from "drizzle-orm"

// Voice Presets Data - Business-friendly voice configurations
const voicePresetsData = [
	// English Voices (5 voices)
	{
		codename: "professional",
		displayName: "Professional",
		language: "en" as const,
		gender: "male" as const,
		description:
			"Authoritative and business-like tone, perfect for formal communications",
		vapiVoiceId: "alloy",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/professional-en.mp3",
		isDefault: true,
		sortOrder: 1
	},
	{
		codename: "friendly",
		displayName: "Friendly",
		language: "en" as const,
		gender: "female" as const,
		description: "Warm and approachable tone, great for customer service",
		vapiVoiceId: "marin",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/friendly-en.mp3",
		isDefault: false,
		sortOrder: 2
	},
	{
		codename: "warm",
		displayName: "Warm",
		language: "en" as const,
		gender: "female" as const,
		description:
			"Caring and empathetic tone, ideal for support conversations",
		vapiVoiceId: "shimmer",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/warm-en.mp3",
		isDefault: false,
		sortOrder: 3
	},
	{
		codename: "confident",
		displayName: "Confident",
		language: "en" as const,
		gender: "male" as const,
		description: "Assertive and persuasive tone, perfect for sales",
		vapiVoiceId: "ash",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/confident-en.mp3",
		isDefault: false,
		sortOrder: 4
	},
	{
		codename: "energetic",
		displayName: "Energetic",
		language: "en" as const,
		gender: "female" as const,
		description: "Enthusiastic and upbeat tone, great for engagement",
		vapiVoiceId: "coral",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/energetic-en.mp3",
		isDefault: false,
		sortOrder: 5
	},

	// Spanish Voices (4 voices)
	{
		codename: "carlos-profesional",
		displayName: "Carlos Profesional",
		language: "es" as const,
		gender: "male" as const,
		description:
			"Voz profesional y autoritaria, perfecta para comunicaciones formales",
		vapiVoiceId: "echo",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/carlos-profesional-es.mp3",
		isDefault: true,
		sortOrder: 1
	},
	{
		codename: "maria-amigable",
		displayName: "Maria Amigable",
		language: "es" as const,
		gender: "female" as const,
		description: "Voz cálida y cercana, ideal para atención al cliente",
		vapiVoiceId: "verse",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/maria-amigable-es.mp3",
		isDefault: false,
		sortOrder: 2
	},
	{
		codename: "confiado",
		displayName: "Confiado",
		language: "es" as const,
		gender: "male" as const,
		description:
			"Voz segura y persuasiva, ideal para ventas y negociaciones",
		vapiVoiceId: "ash",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/confiado-es.mp3",
		isDefault: false,
		sortOrder: 3
	},
	{
		codename: "calida",
		displayName: "Cálida",
		language: "es" as const,
		gender: "female" as const,
		description:
			"Voz empática y reconfortante, perfecta para soporte y acompañamiento",
		vapiVoiceId: "shimmer",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/calida-es.mp3",
		isDefault: false,
		sortOrder: 4
	},

	// French Voices (4 voices)
	{
		codename: "pierre-professionnel",
		displayName: "Pierre Professionnel",
		language: "fr" as const,
		gender: "male" as const,
		description:
			"Voix professionnelle et autoritaire, parfaite pour les communications formelles",
		vapiVoiceId: "sage",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/pierre-professionnel-fr.mp3",
		isDefault: true,
		sortOrder: 1
	},
	{
		codename: "sophie-chaleureuse",
		displayName: "Sophie Chaleureuse",
		language: "fr" as const,
		gender: "female" as const,
		description:
			"Voix chaleureuse et accueillante, idéale pour le service client",
		vapiVoiceId: "ballad",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/sophie-chaleureuse-fr.mp3",
		isDefault: false,
		sortOrder: 2
	},
	{
		codename: "dynamique",
		displayName: "Dynamique",
		language: "fr" as const,
		gender: "female" as const,
		description:
			"Voix énergique et enthousiaste, parfaite pour l'engagement commercial",
		vapiVoiceId: "coral",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/dynamique-fr.mp3",
		isDefault: false,
		sortOrder: 3
	},
	{
		codename: "assure",
		displayName: "Assuré",
		language: "fr" as const,
		gender: "male" as const,
		description:
			"Voix confiante et persuasive, idéale pour la vente et le conseil",
		vapiVoiceId: "ash",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/assure-fr.mp3",
		isDefault: false,
		sortOrder: 4
	},

	// German Voices (4 voices)
	{
		codename: "hans-professionell",
		displayName: "Hans Professionell",
		language: "de" as const,
		gender: "male" as const,
		description:
			"Professionelle und autoritäre Stimme, perfekt für formelle Kommunikation",
		vapiVoiceId: "echo",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/hans-professionell-de.mp3",
		isDefault: true,
		sortOrder: 1
	},
	{
		codename: "anna-freundlich",
		displayName: "Anna Freundlich",
		language: "de" as const,
		gender: "female" as const,
		description: "Warme und einladende Stimme, ideal für Kundenservice",
		vapiVoiceId: "shimmer",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/anna-freundlich-de.mp3",
		isDefault: false,
		sortOrder: 2
	},
	{
		codename: "freundlich-de",
		displayName: "Liebenswürdig",
		language: "de" as const,
		gender: "female" as const,
		description:
			"Herzliche und zugängliche Stimme, großartig für Kundengespräche",
		vapiVoiceId: "marin",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/freundlich-de.mp3",
		isDefault: false,
		sortOrder: 3
	},
	{
		codename: "bestimmt",
		displayName: "Bestimmt",
		language: "de" as const,
		gender: "male" as const,
		description:
			"Überzeugende und selbstbewusste Stimme, perfekt für Vertrieb",
		vapiVoiceId: "ash",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/bestimmt-de.mp3",
		isDefault: false,
		sortOrder: 4
	},

	// Italian Voices (4 voices)
	{
		codename: "professionale-it",
		displayName: "Marco Professionale",
		language: "it" as const,
		gender: "male" as const,
		description:
			"Voce professionale e autorevole, perfetta per comunicazioni formali",
		vapiVoiceId: "alloy",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/professionale-it.mp3",
		isDefault: true,
		sortOrder: 1
	},
	{
		codename: "amichevole-it",
		displayName: "Giulia Amichevole",
		language: "it" as const,
		gender: "female" as const,
		description:
			"Voce amichevole e accogliente, ideale per il servizio clienti",
		vapiVoiceId: "marin",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/amichevole-it.mp3",
		isDefault: false,
		sortOrder: 2
	},
	{
		codename: "sicuro-it",
		displayName: "Luca Sicuro",
		language: "it" as const,
		gender: "male" as const,
		description:
			"Voce sicura e persuasiva, perfetta per vendite e trattative",
		vapiVoiceId: "ash",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/sicuro-it.mp3",
		isDefault: false,
		sortOrder: 3
	},
	{
		codename: "calorosa-it",
		displayName: "Elena Calorosa",
		language: "it" as const,
		gender: "female" as const,
		description:
			"Voce calorosa ed empatica, ideale per supporto e assistenza",
		vapiVoiceId: "coral",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/calorosa-it.mp3",
		isDefault: false,
		sortOrder: 4
	},

	// Portuguese Voices (4 voices)
	{
		codename: "profissional-pt",
		displayName: "Pedro Profissional",
		language: "pt" as const,
		gender: "male" as const,
		description:
			"Voz profissional e confiável, perfeita para comunicações formais",
		vapiVoiceId: "echo",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/profissional-pt.mp3",
		isDefault: true,
		sortOrder: 1
	},
	{
		codename: "simpatica-pt",
		displayName: "Ana Simpática",
		language: "pt" as const,
		gender: "female" as const,
		description:
			"Voz simpática e acolhedora, ideal para atendimento ao cliente",
		vapiVoiceId: "shimmer",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/simpatica-pt.mp3",
		isDefault: false,
		sortOrder: 2
	},
	{
		codename: "energetica-pt",
		displayName: "Clara Energética",
		language: "pt" as const,
		gender: "female" as const,
		description:
			"Voz animada e entusiasmada, ótima para engajamento e vendas",
		vapiVoiceId: "coral",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/energetica-pt.mp3",
		isDefault: false,
		sortOrder: 3
	},
	{
		codename: "tranquilo-pt",
		displayName: "Rafael Tranquilo",
		language: "pt" as const,
		gender: "male" as const,
		description:
			"Voz calma e ponderada, perfeita para suporte e acompanhamento",
		vapiVoiceId: "sage",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/tranquilo-pt.mp3",
		isDefault: false,
		sortOrder: 4
	},

	// Chinese Voices (4 voices)
	{
		codename: "zhuanye-zh",
		displayName: "专业 (Professional)",
		language: "zh" as const,
		gender: "male" as const,
		description: "专业且权威的语气，适合正式商务沟通",
		vapiVoiceId: "alloy",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/zhuanye-zh.mp3",
		isDefault: true,
		sortOrder: 1
	},
	{
		codename: "qinqie-zh",
		displayName: "亲切 (Friendly)",
		language: "zh" as const,
		gender: "female" as const,
		description: "温暖且亲切的语气，适合客户服务",
		vapiVoiceId: "marin",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/qinqie-zh.mp3",
		isDefault: false,
		sortOrder: 2
	},
	{
		codename: "zixin-zh",
		displayName: "自信 (Confident)",
		language: "zh" as const,
		gender: "male" as const,
		description: "自信且有说服力的语气，适合销售和谈判",
		vapiVoiceId: "ash",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/zixin-zh.mp3",
		isDefault: false,
		sortOrder: 3
	},
	{
		codename: "wenrou-zh",
		displayName: "温柔 (Warm)",
		language: "zh" as const,
		gender: "female" as const,
		description: "温柔且体贴的语气，适合关怀和支持",
		vapiVoiceId: "shimmer",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/wenrou-zh.mp3",
		isDefault: false,
		sortOrder: 4
	},

	// Hindi Voices (4 voices)
	{
		codename: "vyavsayik-hi",
		displayName: "व्यावसायिक (Professional)",
		language: "hi" as const,
		gender: "male" as const,
		description: "पेशेवर और विश्वसनीय स्वर, औपचारिक संवाद के लिए उपयुक्त",
		vapiVoiceId: "echo",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/vyavsayik-hi.mp3",
		isDefault: true,
		sortOrder: 1
	},
	{
		codename: "milansar-hi",
		displayName: "मिलनसार (Friendly)",
		language: "hi" as const,
		gender: "female" as const,
		description: "मिलनसार और सुलभ स्वर, ग्राहक सेवा के लिए आदर्श",
		vapiVoiceId: "verse",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/milansar-hi.mp3",
		isDefault: false,
		sortOrder: 2
	},
	{
		codename: "sneh-hi",
		displayName: "स्नेही (Warm)",
		language: "hi" as const,
		gender: "female" as const,
		description: "सहानुभूतिपूर्ण और देखभाल करने वाला स्वर, सहायता के लिए उपयुक्त",
		vapiVoiceId: "shimmer",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/sneh-hi.mp3",
		isDefault: false,
		sortOrder: 3
	},
	{
		codename: "vishwas-hi",
		displayName: "विश्वसनीय (Confident)",
		language: "hi" as const,
		gender: "male" as const,
		description: "आत्मविश्वासी और प्रेरक स्वर, बिक्री के लिए उत्कृष्ट",
		vapiVoiceId: "sage",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/vishwas-hi.mp3",
		isDefault: false,
		sortOrder: 4
	},

	// Arabic Voices (4 voices)
	{
		codename: "mihani-ar",
		displayName: "مهني (Professional)",
		language: "ar" as const,
		gender: "male" as const,
		description: "صوت مهني وموثوق، مثالي للتواصل الرسمي",
		vapiVoiceId: "alloy",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/mihani-ar.mp3",
		isDefault: true,
		sortOrder: 1
	},
	{
		codename: "hanuna-ar",
		displayName: "حنونة (Warm)",
		language: "ar" as const,
		gender: "female" as const,
		description: "صوت دافئ ومرحب، مثالي لخدمة العملاء",
		vapiVoiceId: "marin",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/hanuna-ar.mp3",
		isDefault: false,
		sortOrder: 2
	},
	{
		codename: "wathiq-ar",
		displayName: "واثق (Confident)",
		language: "ar" as const,
		gender: "male" as const,
		description: "صوت واثق ومقنع، مثالي للمبيعات والتفاوض",
		vapiVoiceId: "ash",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/wathiq-ar.mp3",
		isDefault: false,
		sortOrder: 3
	},
	{
		codename: "dafi-ar",
		displayName: "دافعة (Energetic)",
		language: "ar" as const,
		gender: "female" as const,
		description: "صوت حيوي ومتحمس، رائع للتفاعل والمشاركة",
		vapiVoiceId: "coral",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/dafi-ar.mp3",
		isDefault: false,
		sortOrder: 4
	},

	// Japanese Voices (4 voices)
	{
		codename: "teinei-ja",
		displayName: "丁寧 (Polite)",
		language: "ja" as const,
		gender: "male" as const,
		description: "丁寧でプロフェッショナルな声、フォーマルな対応に最適",
		vapiVoiceId: "sage",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/teinei-ja.mp3",
		isDefault: true,
		sortOrder: 1
	},
	{
		codename: "shinsetsu-ja",
		displayName: "親切 (Kind)",
		language: "ja" as const,
		gender: "female" as const,
		description: "親切で温かみのある声、カスタマーサービスに最適",
		vapiVoiceId: "shimmer",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/shinsetsu-ja.mp3",
		isDefault: false,
		sortOrder: 2
	},
	{
		codename: "ochitsuki-ja",
		displayName: "落ち着き (Calm)",
		language: "ja" as const,
		gender: "female" as const,
		description: "落ち着いた穏やかな声、サポートや相談に最適",
		vapiVoiceId: "ballad",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/ochitsuki-ja.mp3",
		isDefault: false,
		sortOrder: 3
	},
	{
		codename: "kakushin-ja",
		displayName: "確信 (Assured)",
		language: "ja" as const,
		gender: "male" as const,
		description: "自信に満ちた説得力のある声、営業や提案に最適",
		vapiVoiceId: "alloy",
		vapiProvider: "openai",
		vapiModel: "gpt-realtime-mini-2025-12-15",
		sampleAudioUrl: "/audio/voices/kakushin-ja.mp3",
		isDefault: false,
		sortOrder: 4
	}
]

// Agent Roles Data - Pre-built business role configurations
const agentRolesData = [
	{
		roleName: "customer-service",
		displayName: "Customer Service",
		description:
			"Handle customer inquiries, resolve issues, and provide support",
		icon: "headphones",
		systemPrompt: `You are a professional customer service representative. Your primary goals are to:

1. Listen carefully to customer concerns and questions
2. Provide helpful, accurate information
3. Resolve issues efficiently and effectively
4. Maintain a patient and empathetic tone
5. Escalate complex issues when necessary

Key guidelines:
- Always greet customers warmly
- Ask clarifying questions to understand their needs
- Provide clear, step-by-step solutions
- Confirm customer satisfaction before ending calls
- Take detailed notes for follow-up
- Stay calm and professional, even with frustrated customers

You have access to company knowledge base and can update customer records.`,
		conversationStyle: "Patient, helpful, and solution-oriented",
		industryFocus: "Universal - suitable for any business",
		sampleConversation:
			'Customer: "Hi, I\'m having trouble with my order." Agent: "I\'m sorry to hear that! I\'d be happy to help you with your order. Can you please provide me with your order number so I can look into this for you?"',
		defaultFunctions: [
			{
				name: "updateLeadStatus",
				description: "Update the status of a customer/lead record",
				webhook: "/api/functions/update-lead-status",
				parameters: [
					{
						name: "leadId",
						type: "number" as const,
						description: "ID of the lead to update",
						required: true
					},
					{
						name: "status",
						type: "string" as const,
						description: "New status for the lead",
						required: true
					},
					{
						name: "notes",
						type: "string" as const,
						description: "Additional notes about the interaction",
						required: false
					}
				]
			},
			{
				name: "addNoteToLead",
				description: "Add a note to customer record",
				webhook: "/api/functions/add-note",
				parameters: [
					{
						name: "leadId",
						type: "number" as const,
						description: "ID of the lead",
						required: true
					},
					{
						name: "note",
						type: "string" as const,
						description: "Note content",
						required: true
					},
					{
						name: "category",
						type: "string" as const,
						description: "Note category",
						required: false
					}
				]
			},
			{
				name: "scheduleCallback",
				description: "Schedule a callback for the customer",
				webhook: "/api/functions/schedule-callback",
				parameters: [
					{
						name: "leadId",
						type: "number" as const,
						description: "ID of the lead",
						required: true
					},
					{
						name: "callbackTime",
						type: "string" as const,
						description: "Preferred callback time",
						required: true
					},
					{
						name: "reason",
						type: "string" as const,
						description: "Reason for callback",
						required: true
					}
				]
			}
		],
		defaultConfiguration: {
			flow: {
				user_start_first: false,
				interruption: {
					allowed: true,
					keep_interruption_message: true,
					first_message: false
				},
				response_delay: 1.5,
				inactivity_handling: {
					idle_time: 10,
					message:
						"I'm here to help. Is there anything else I can assist you with today?"
				},
				agent_terminate_call: {
					enabled: true,
					instruction:
						"End the call politely when the customer's issue is resolved and they confirm satisfaction",
					messages: [
						"Thank you for calling! Have a great day!",
						"Is there anything else I can help you with before we end the call?"
					]
				}
			},
			llm: {
				model: "gpt-4o",
				temperature: 0.3
			},
			session_timeout: {
				max_duration: 1800, // 30 minutes
				max_idle: 300, // 5 minutes
				message:
					"Thank you for your time. If you need further assistance, please don't hesitate to call us back."
			}
		},
		firstMessageTemplate:
			"Hello! Thank you for calling. I'm here to help with any questions or concerns you might have. How can I assist you today?",
		isActive: true,
		sortOrder: 1
	},
	{
		roleName: "sales",
		displayName: "Sales Representative",
		description: "Qualify leads, present solutions, and close deals",
		icon: "trending-up",
		systemPrompt: `You are a professional sales representative. Your primary goals are to:

1. Qualify leads and understand their needs
2. Present relevant solutions and benefits
3. Handle objections professionally
4. Guide prospects toward a purchase decision
5. Create urgency when appropriate

Key sales techniques:
- Ask open-ended questions to uncover needs
- Listen more than you talk (70/30 rule)
- Present benefits, not just features
- Use social proof and testimonials
- Create urgency with limited-time offers
- Ask for the sale confidently
- Handle objections as buying signals

Follow the BANT qualification framework:
- Budget: Can they afford our solution?
- Authority: Are they the decision maker?
- Need: Do they have a genuine need?
- Timeline: When do they need a solution?

Always aim to schedule a follow-up meeting or close the sale.`,
		conversationStyle: "Engaging, persuasive, and goal-oriented",
		industryFocus: "B2B and B2C sales across industries",
		sampleConversation:
			'Prospect: "Tell me about your services." Agent: "I\'d be happy to share how we can help! First, let me ask - what\'s the biggest challenge you\'re facing with [relevant area] right now?"',
		defaultFunctions: [
			{
				name: "updateLeadStatus",
				description: "Update lead qualification status",
				webhook: "/api/functions/update-lead-status",
				parameters: [
					{
						name: "leadId",
						type: "number" as const,
						description: "ID of the lead to update",
						required: true
					},
					{
						name: "status",
						type: "string" as const,
						description: "New qualification status",
						required: true
					},
					{
						name: "score",
						type: "number" as const,
						description: "Lead score (0-100)",
						required: false
					}
				]
			},
			{
				name: "scheduleAppointment",
				description: "Schedule a sales appointment or demo",
				webhook: "/api/functions/schedule-appointment",
				parameters: [
					{
						name: "leadId",
						type: "number" as const,
						description: "ID of the lead",
						required: true
					},
					{
						name: "appointmentTime",
						type: "string" as const,
						description: "Proposed appointment time",
						required: true
					},
					{
						name: "appointmentType",
						type: "string" as const,
						description:
							"Type of appointment (demo, consultation, etc.)",
						required: true
					}
				]
			},
			{
				name: "calculateQuote",
				description: "Generate a price quote for the prospect",
				webhook: "/api/functions/calculate-quote",
				parameters: [
					{
						name: "leadId",
						type: "number" as const,
						description: "ID of the lead",
						required: true
					},
					{
						name: "products",
						type: "array" as const,
						description: "List of products/services",
						required: true
					},
					{
						name: "discountLevel",
						type: "string" as const,
						description: "Applicable discount level",
						required: false
					}
				]
			}
		],
		defaultConfiguration: {
			flow: {
				user_start_first: false,
				interruption: {
					allowed: true,
					keep_interruption_message: false,
					first_message: false
				},
				response_delay: 1.0,
				inactivity_handling: {
					idle_time: 8,
					message:
						"I want to make sure I'm addressing all your questions. What would you like to know more about?"
				},
				agent_terminate_call: {
					enabled: true,
					instruction:
						"End the call with a clear next step - either a scheduled appointment or a definitive follow-up action",
					messages: [
						"Let me schedule a time to follow up with you.",
						"When would be a good time for me to call you back?"
					]
				}
			},
			llm: {
				model: "gpt-4o",
				temperature: 0.4
			},
			session_timeout: {
				max_duration: 2400, // 40 minutes
				max_idle: 180, // 3 minutes
				message:
					"I want to be respectful of your time. Should we schedule a follow-up call to continue our discussion?"
			}
		},
		firstMessageTemplate:
			"Hi there! Thanks for your interest in our solutions. I'd love to learn more about your business and see how we can help you achieve your goals. What's your biggest challenge right now?",
		isActive: true,
		sortOrder: 2
	},
	{
		roleName: "appointment-setting",
		displayName: "Appointment Setter",
		description: "Schedule appointments and manage calendars efficiently",
		icon: "calendar",
		systemPrompt: `You are a professional appointment setter. Your primary goals are to:

1. Quickly understand the caller's scheduling needs
2. Find mutually convenient appointment times
3. Confirm all appointment details clearly
4. Handle rescheduling requests efficiently
5. Send confirmation details

Key appointment setting guidelines:
- Be efficient and direct with scheduling
- Always confirm date, time, duration, and location/method
- Offer 2-3 specific time options rather than open-ended questions
- Handle conflicts gracefully with alternatives
- Take contact information for confirmations
- Set clear expectations about what to prepare
- Send immediate confirmation
- Ask about preferred communication method

Appointment types you handle:
- Consultations and discovery calls
- Product demos and presentations
- Follow-up meetings
- Service appointments
- Training sessions

Always prioritize the customer's schedule while maximizing bookings.`,
		conversationStyle: "Efficient, organized, and accommodating",
		industryFocus: "Service businesses, consultants, sales teams",
		sampleConversation:
			'Caller: "I\'d like to schedule a consultation." Agent: "Absolutely! I\'d be happy to get that scheduled for you. Are you available this week? I have openings Tuesday at 2 PM, Wednesday at 10 AM, or Thursday at 3 PM. Which works best for you?"',
		defaultFunctions: [
			{
				name: "scheduleAppointment",
				description: "Create a new appointment",
				webhook: "/api/functions/schedule-appointment",
				parameters: [
					{
						name: "leadId",
						type: "number" as const,
						description: "ID of the lead",
						required: true
					},
					{
						name: "appointmentTime",
						type: "string" as const,
						description: "Appointment date and time",
						required: true
					},
					{
						name: "duration",
						type: "number" as const,
						description: "Duration in minutes",
						required: true
					},
					{
						name: "appointmentType",
						type: "string" as const,
						description: "Type of appointment",
						required: true
					},
					{
						name: "location",
						type: "string" as const,
						description: "Meeting location or video link",
						required: false
					}
				]
			},
			{
				name: "checkAvailability",
				description: "Check calendar availability for specific times",
				webhook: "/api/functions/check-availability",
				parameters: [
					{
						name: "startDate",
						type: "string" as const,
						description: "Start date for availability check",
						required: true
					},
					{
						name: "endDate",
						type: "string" as const,
						description: "End date for availability check",
						required: true
					},
					{
						name: "duration",
						type: "number" as const,
						description: "Required duration in minutes",
						required: true
					}
				]
			},
			{
				name: "sendConfirmation",
				description: "Send appointment confirmation to customer",
				webhook: "/api/functions/send-confirmation",
				parameters: [
					{
						name: "appointmentId",
						type: "number" as const,
						description: "ID of the appointment",
						required: true
					},
					{
						name: "method",
						type: "string" as const,
						description: "Confirmation method (email, sms)",
						required: true
					}
				]
			}
		],
		defaultConfiguration: {
			flow: {
				user_start_first: false,
				interruption: {
					allowed: true,
					keep_interruption_message: true,
					first_message: false
				},
				response_delay: 0.8,
				inactivity_handling: {
					idle_time: 15,
					message:
						"I want to make sure we get this scheduled for you. Are you still there?"
				},
				agent_terminate_call: {
					enabled: true,
					instruction:
						"End the call only after appointment is confirmed and details are provided",
					messages: [
						"Perfect! You're all set. You should receive a confirmation shortly.",
						"Is there anything else I can help you with regarding your appointment?"
					]
				}
			},
			llm: {
				model: "gpt-4o",
				temperature: 0.2
			},
			session_timeout: {
				max_duration: 900, // 15 minutes
				max_idle: 120, // 2 minutes
				message:
					"Let me get this appointment scheduled for you quickly. Which time works best?"
			}
		},
		firstMessageTemplate:
			"Hello! I understand you'd like to schedule an appointment. I'll be happy to find a time that works perfectly for you. What type of appointment are you looking to book?",
		isActive: true,
		sortOrder: 3
	}
]

async function seedVoiceData() {
	console.log("🌱 Starting voice data seed...")

	try {
		// Insert voice presets
		console.log("📢 Seeding voice presets...")
		for (const preset of voicePresetsData) {
			const existing = await db.query.voicePresets.findFirst({
				where: (presets, { eq }) =>
					eq(presets.codename, preset.codename)
			})

			if (!existing) {
				await db.insert(voicePresets).values(preset)
				console.log(
					`  ✅ Added voice preset: ${preset.displayName} (${preset.language})`
				)
			} else if (
				preset.sampleAudioUrl &&
				existing.sampleAudioUrl !== preset.sampleAudioUrl
			) {
				await db
					.update(voicePresets)
					.set({ sampleAudioUrl: preset.sampleAudioUrl })
					.where(eq(voicePresets.codename, preset.codename))
				console.log(
					`  🔊 Updated sample audio for: ${preset.displayName}`
				)
			} else {
				console.log(
					`  ⏭️  Voice preset already exists: ${preset.displayName}`
				)
			}
		}

		// Insert agent roles
		console.log("🎭 Seeding agent roles...")
		for (const role of agentRolesData) {
			const existing = await db.query.agentRoles.findFirst({
				where: (roles, { eq }) => eq(roles.roleName, role.roleName)
			})

			if (!existing) {
				await db.insert(agentRoles).values(role)
				console.log(`  ✅ Added agent role: ${role.displayName}`)
			} else {
				console.log(
					`  ⏭️  Agent role already exists: ${role.displayName}`
				)
			}
		}

		console.log("✨ Voice data seed completed successfully!")
		console.log("📊 Summary:")
		console.log(`   - Voice presets: ${voicePresetsData.length} total`)
		console.log(`   - Agent roles: ${agentRolesData.length} total`)
		console.log("   - Languages supported: en, es, fr, de")
	} catch (error) {
		console.error("❌ Failed to seed voice data:", error)
		throw error
	}
}

// Run the seed if this file is executed directly
if (require.main === module) {
	seedVoiceData()
		.then(() => {
			console.log("🎉 Seed completed!")
			process.exit(0)
		})
		.catch((error) => {
			console.error("💥 Seed failed:", error)
			process.exit(1)
		})
}

export { seedVoiceData }
