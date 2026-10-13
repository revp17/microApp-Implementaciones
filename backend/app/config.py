from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    cors_origins: str = "http://localhost:5173"
    nhost_subdomain: str = ""
    nhost_region: str = ""
    nhost_admin_secret: str = ""

    @property
    def auth_url(self) -> str:
        return f"https://{self.nhost_subdomain}.auth.{self.nhost_region}.nhost.run/v1"

    @property
    def graphql_url(self) -> str:
        return f"https://{self.nhost_subdomain}.graphql.{self.nhost_region}.nhost.run/v1"

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
