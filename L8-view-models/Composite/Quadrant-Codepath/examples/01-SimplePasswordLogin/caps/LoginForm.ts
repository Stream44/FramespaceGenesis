export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: {
    encapsulate: any
    CapsulePropertyTypes: any
    makeImportStack: any
}) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},

            // Dimension: Column
            '#../view/Columns/Form': {},

            // Dimension: Row
            '#../view/Rows/Client': {},

            '#': {
                _email: {
                    type: CapsulePropertyTypes.String,
                    value: '',
                },
                _password: {
                    type: CapsulePropertyTypes.String,
                    value: '',
                },
                _error: {
                    type: CapsulePropertyTypes.Literal,
                    value: null as string | null,
                },
                httpClient: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './HttpClient',
                },
                setEmail: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, value: string) {
                        this._email = value
                    }
                },
                setPassword: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, value: string) {
                        this._password = value
                    }
                },
                validate: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string[] {
                        const errors: string[] = []
                        if (!this._email || !this._email.includes('@')) {
                            errors.push('Invalid email format')
                        }
                        if (!this._password || this._password.length < 6) {
                            errors.push('Password must be at least 6 characters')
                        }
                        return errors
                    }
                },
                submit: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any) {
                        this._error = null
                        const errors = this.validate()
                        if (errors.length > 0) {
                            this._error = errors[0]
                            return { success: false, error: this._error }
                        }
                        const response = this.httpClient.post('/api/auth/login', {
                            email: this._email,
                            password: this._password
                        })
                        if (response.success) {
                            this._email = ''
                            this._password = ''
                            this._error = null
                            return { success: true, redirectUrl: response.redirectUrl, token: response.token }
                        } else {
                            this._error = response.error || 'Login failed'
                            return { success: false, error: this._error }
                        }
                    }
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: capsule['#'],
    })
}
capsule['#'] = '@stream44.studio/FramespaceGenesis/L8-view-models/Composite/Quadrant-Codepath/examples/01-SimplePasswordLogin/caps/LoginForm'
